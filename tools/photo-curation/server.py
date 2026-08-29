#!/usr/bin/env python3
"""Loopback-only private photo curation tool for Synergetic Human."""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
STATIC = Path(__file__).resolve().parent / "static"
INVENTORY_DIR = Path(os.environ.get("SYNERGETIC_PHOTO_INVENTORY", str(ROOT / "artifacts/photo-inventory/raw-export-v1"))).resolve()
INVENTORY = INVENTORY_DIR / "logical-assets.private.jsonl"
BURSTS = INVENTORY_DIR / "burst-candidates.private.json"
SIMILAR = INVENTORY_DIR / "visual-similarity.private.json"
TIMELINE = ROOT / "data/brain/travel/travel-timeline.v1.json"
CORRECTIONS = ROOT / "data/brain/travel/editorial-route-corrections.v1.json"
CURATION_DIR = ROOT / "artifacts/photo-curation/stage2"
DATA_DIR = Path(os.environ.get("SYNERGETIC_PHOTO_CURATION_DATA", str(CURATION_DIR))).resolve()
MANIFEST = DATA_DIR / "curation-manifest.private.json"
EVENTS = DATA_DIR / "curation-events.private.jsonl"
PREVIEWS = Path(os.environ.get("SYNERGETIC_PHOTO_PREVIEWS", str(CURATION_DIR / "previews.private"))).resolve()
THUMBNAILS = INVENTORY_DIR / "thumbnails.private"
SOURCE = Path(os.environ.get("SYNERGETIC_PHOTO_SOURCE", str(ROOT.parent / "Synergetic-Human-Photos-Raw"))).resolve()
LOCK = threading.Lock()
STATUSES = {None, "keep", "maybe", "private"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def display_path(path: Path) -> str:
    try: return str(path.relative_to(ROOT))
    except ValueError: return str(path)


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def inventory_hash() -> str:
    digest = hashlib.sha256()
    with INVENTORY.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_travel() -> tuple[list[dict], dict[str, dict]]:
    timeline = json.loads(TIMELINE.read_text())
    places = {place["id"]: place for place in timeline["places"]}
    visits = list(timeline["visits"])
    correction = json.loads(CORRECTIONS.read_text())["corrections"][0]
    for visit in visits:
        if visit["chronologyIndex"] >= correction["visit"]["chronologyIndex"]:
            visit["chronologyIndex"] += 1
    place = correction["place"]
    place_id = "editorial-place:vaduz"
    places[place_id] = {
        "id": place_id, "name": place["name"], "slug": place["slug"],
        "countryName": place["countryName"], "countryCode": place["countryCode"],
    }
    visit = correction["visit"]
    visits.append({
        "id": "editorial-visit:vaduz:2026-05", "placeId": place_id,
        "chronologyIndex": visit["chronologyIndex"],
        "start": {"year": visit["startYear"], "month": visit["startMonth"]},
        "end": {"year": visit["endYear"], "month": visit["endMonth"]},
    })
    visits.sort(key=lambda item: item["chronologyIndex"])
    options = []
    for item in visits:
        place = places[item["placeId"]]
        options.append({
            "id": item["id"], "placeId": item["placeId"], "placeName": place["name"],
            "country": place["countryName"], "chronologyIndex": item["chronologyIndex"],
            "year": item["start"]["year"], "month": item["start"]["month"],
            "label": f'{place["name"]} · {item["start"]["year"]}-{item["start"]["month"]:02d}',
        })
    return options, {item["id"]: item for item in options}


VISITS, VISIT_BY_ID = load_travel()
ASSET_ROWS = read_jsonl(INVENTORY)
ASSET_BY_ID = {asset["logical_asset_id"]: asset for asset in ASSET_ROWS}
if len(ASSET_BY_ID) != len(ASSET_ROWS):
    raise SystemExit("Logical photo asset identifiers must be unique")


def load_group_flags() -> tuple[set[str], set[str]]:
    burst_ids = set()
    if BURSTS.exists():
        for group in json.loads(BURSTS.read_text()).get("groups", []):
            burst_ids.update(asset["id"] for asset in group.get("assets", []))
    similar_ids = set()
    if SIMILAR.exists():
        for group in json.loads(SIMILAR.read_text()).get("groups", []):
            similar_ids.update(asset["id"] for asset in group.get("assets", []))
    return burst_ids, similar_ids


BURST_IDS, SIMILAR_IDS = load_group_flags()


def empty_manifest() -> dict:
    created = now()
    return {
        "schemaVersion": "synergetic-photo-curation.v1",
        "createdAt": created,
        "updatedAt": created,
        "revision": 0,
        "sourceInventory": {
            "relativePath": "artifacts/photo-inventory/raw-export-v1/logical-assets.private.jsonl",
            "sha256": inventory_hash(),
            "logicalAssetCount": len(ASSET_ROWS),
            "livePhotos": sum(row["asset_kind"] == "live_photo" for row in ASSET_ROWS),
            "stillPhotos": sum(row["asset_kind"] == "still_photo" for row in ASSET_ROWS),
            "standaloneVideos": sum(row["asset_kind"] == "standalone_video" for row in ASSET_ROWS),
        },
        "publicationStates": {"keep": 0, "maybe": 0, "private": 0, "unreviewed": len(ASSET_ROWS)},
        "assets": {},
        "heroes": {},
    }


def load_manifest() -> dict:
    if not MANIFEST.exists():
        return empty_manifest()
    manifest = json.loads(MANIFEST.read_text())
    if manifest.get("schemaVersion") != "synergetic-photo-curation.v1":
        raise RuntimeError("Unsupported curation manifest version")
    return manifest


def counts(manifest: dict) -> dict:
    result = {"keep": 0, "maybe": 0, "private": 0, "unreviewed": 0, "wallpaper": 0, "hero": len(manifest.get("heroes", {}))}
    for asset in ASSET_ROWS:
        decision = manifest.get("assets", {}).get(asset["logical_asset_id"], {})
        status = decision.get("publicationStatus")
        result[status or "unreviewed"] += 1
        if decision.get("wallpaper"): result["wallpaper"] += 1
    return result


def atomic_write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w") as target:
        json.dump(value, target, indent=2, ensure_ascii=False, sort_keys=True)
        target.write("\n"); target.flush(); os.fsync(target.fileno())
    os.replace(temporary, path)


def append_event(event: dict) -> None:
    EVENTS.parent.mkdir(parents=True, exist_ok=True)
    with EVENTS.open("a") as target:
        target.write(json.dumps(event, ensure_ascii=False, sort_keys=True) + "\n")
        target.flush(); os.fsync(target.fileno())


def inferred_association(asset: dict) -> dict:
    visit = asset.get("visit_assignment")
    if visit:
        return {
            "kind": "visit", "visitId": visit["visit_id"], "placeName": visit["place_name"],
            "label": visit["place_name"], "state": visit["state"], "uncertain": visit["state"] != "strong",
            "basis": visit["basis"], "distanceKm": visit.get("distance_km"),
        }
    place = asset.get("nearest_travel_place")
    if place:
        return {
            "kind": "placeCandidate", "placeId": place["place_id"], "placeName": place["place_name"],
            "label": place["place_name"], "country": place["country"], "state": place["state"],
            "uncertain": True, "basis": "GPS proximity; visit/date unresolved", "distanceKm": place.get("distance_km"),
        }
    geo = asset.get("nearest_geonames")
    if geo:
        return {
            "kind": "locationCandidate", "label": f'{geo["city"]}, {geo["country"]}',
            "placeName": geo["city"], "country": geo["country"], "state": geo["confidence"],
            "uncertain": True, "basis": "GPS nearest-place suggestion", "distanceKm": geo.get("distance_km"),
        }
    return {"kind": "unassigned", "label": "Location unassigned", "state": "unavailable", "uncertain": True, "basis": "No usable GPS association"}


def effective_association(asset: dict, decision: dict) -> dict:
    override = decision.get("associationOverride")
    if override and override.get("visitId") in VISIT_BY_ID:
        visit = VISIT_BY_ID[override["visitId"]]
        return {
            "kind": "manualVisit", "visitId": visit["id"], "placeId": visit["placeId"],
            "placeName": visit["placeName"], "country": visit["country"], "label": visit["label"],
            "state": "approved", "uncertain": False, "basis": "Joe manual curation correction",
        }
    return inferred_association(asset)


def cluster_for(asset: dict, decision: dict) -> dict:
    association = effective_association(asset, decision)
    capture = asset.get("capture_parts") or []
    month = f"{capture[0]:04d}-{capture[1]:02d}" if len(capture) >= 2 else "Date unknown"
    if association["kind"] in {"visit", "manualVisit"}:
        visit_id = association.get("visitId")
        visit = VISIT_BY_ID.get(visit_id)
        label = visit["label"] if visit else f'{association["label"]} · {month}'
        return {"key": f"visit:{visit_id}", "label": label, "sort": f"0:{month}:{label}", "heroEligible": True, "uncertain": association["uncertain"]}
    if association["kind"] == "placeCandidate":
        return {"key": f'place-candidate:{association["placeId"]}:{month}', "label": f'{association["label"]} · {month}', "sort": f"1:{month}:{association['label']}", "heroEligible": True, "uncertain": True}
    if association["kind"] == "locationCandidate":
        slug = re.sub(r"[^a-z0-9]+", "-", association["label"].casefold()).strip("-")
        return {"key": f"location-candidate:{slug}:{month}", "label": f'{association["label"]} · {month}', "sort": f"2:{month}:{association['label']}", "heroEligible": True, "uncertain": True}
    return {"key": f"unassigned:{month}", "label": f"Unassigned · {month}", "sort": f"9:{month}", "heroEligible": False, "uncertain": True}


def public_asset(asset: dict, manifest: dict) -> dict:
    asset_id = asset["logical_asset_id"]
    decision = manifest.get("assets", {}).get(asset_id, {})
    association = effective_association(asset, decision)
    cluster = cluster_for(asset, decision)
    hero_asset = manifest.get("heroes", {}).get(cluster["key"], {}).get("assetId")
    return {
        "id": asset_id, "kind": asset["asset_kind"], "filename": asset["primary_filename"],
        "captureAt": asset.get("capture_at"), "captureParts": asset.get("capture_parts"),
        "camera": " ".join(filter(None, [asset.get("camera_make"), asset.get("camera_model")])),
        "hasGps": asset.get("latitude") is not None and asset.get("longitude") is not None,
        "orientation": asset.get("orientation"), "width": asset.get("width"), "height": asset.get("height"),
        "sourceFiles": asset.get("source_files", []), "association": association, "cluster": cluster,
        "publicationStatus": decision.get("publicationStatus"), "wallpaper": bool(decision.get("wallpaper")),
        "isHero": hero_asset == asset_id, "associationOverride": decision.get("associationOverride"),
        "burstCandidate": asset_id in BURST_IDS, "similarCandidate": asset_id in SIMILAR_IDS,
        "previewUrl": f"/media/{asset_id}", "videoUrl": f"/video/{asset_id}" if asset["asset_kind"] == "standalone_video" else None,
    }


def save_action(payload: dict) -> dict:
    asset_id = payload.get("assetId")
    if asset_id not in ASSET_BY_ID: raise ValueError("Unknown logical asset")
    action = payload.get("action")
    with LOCK:
        manifest = load_manifest()
        decisions = manifest.setdefault("assets", {})
        before = json.loads(json.dumps(decisions.get(asset_id, {})))
        decision = decisions.setdefault(asset_id, {})
        event_extra = {}
        if action == "status":
            status = payload.get("value")
            if status not in STATUSES: raise ValueError("Invalid publication status")
            decision["publicationStatus"] = status
        elif action == "wallpaper":
            decision["wallpaper"] = bool(payload.get("value"))
        elif action == "association":
            old_cluster = cluster_for(ASSET_BY_ID[asset_id], decision)
            visit_id = payload.get("visitId")
            if visit_id is not None and visit_id not in VISIT_BY_ID: raise ValueError("Unknown visit")
            decision["associationOverride"] = {"visitId": visit_id} if visit_id else None
            new_cluster = cluster_for(ASSET_BY_ID[asset_id], decision)
            previous_hero = manifest.setdefault("heroes", {}).get(old_cluster["key"])
            if old_cluster["key"] != new_cluster["key"] and previous_hero and previous_hero.get("assetId") == asset_id:
                manifest["heroes"].pop(old_cluster["key"], None)
            event_extra = {"previousCluster": old_cluster["key"], "newCluster": new_cluster["key"], "clearedPreviousHero": previous_hero if old_cluster["key"] != new_cluster["key"] else None}
        elif action == "hero":
            scope_key = str(payload.get("scopeKey", ""))[:220]
            scope_label = str(payload.get("scopeLabel", ""))[:220]
            if not scope_key or scope_key.startswith("unassigned:"): raise ValueError("This cluster cannot have a hero")
            previous = manifest.setdefault("heroes", {}).get(scope_key)
            enabled = bool(payload.get("value"))
            if enabled:
                manifest["heroes"][scope_key] = {"assetId": asset_id, "label": scope_label, "updatedAt": now()}
            elif previous and previous.get("assetId") == asset_id:
                manifest["heroes"].pop(scope_key, None)
            event_extra = {"scopeKey": scope_key, "scopeLabel": scope_label, "previousHero": previous}
        else: raise ValueError("Unknown action")
        decision["updatedAt"] = now()
        after = json.loads(json.dumps(decision))
        manifest["revision"] = int(manifest.get("revision", 0)) + 1
        manifest["updatedAt"] = now()
        manifest["publicationStates"] = counts(manifest)
        event = {
            "eventId": str(uuid.uuid4()), "revision": manifest["revision"], "recordedAt": now(),
            "assetId": asset_id, "action": action, "before": before, "after": after, **event_extra,
        }
        append_event(event)
        atomic_write(MANIFEST, manifest)
        return {"ok": True, "revision": manifest["revision"], "counts": counts(manifest), "asset": public_asset(ASSET_BY_ID[asset_id], manifest), "heroes": manifest.get("heroes", {})}


class Handler(BaseHTTPRequestHandler):
    server_version = "SynergeticPhotoCuration/1.0"

    def log_message(self, format: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")

    def common_headers(self, content_type: str, length: int | None = None) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'")
        if length is not None: self.send_header("Content-Length", str(length))

    def send_json(self, value: dict, status=HTTPStatus.OK) -> None:
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status); self.common_headers("application/json; charset=utf-8", len(body)); self.end_headers(); self.wfile.write(body)

    def send_file(self, path: Path, content_type: str | None = None) -> None:
        if not path.is_file(): self.send_error(HTTPStatus.NOT_FOUND); return
        body = path.read_bytes(); self.send_response(HTTPStatus.OK)
        self.common_headers(content_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream", len(body)); self.end_headers(); self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/state":
            manifest = load_manifest()
            self.send_json({
                "privateLocalOnly": True, "inventoryCount": len(ASSET_ROWS), "counts": counts(manifest),
                "revision": manifest.get("revision", 0), "assets": [public_asset(asset, manifest) for asset in ASSET_ROWS],
                "visits": VISITS, "heroes": manifest.get("heroes", {}),
                "manifestPath": display_path(MANIFEST),
            }); return
        if path == "/api/health": self.send_json({"ok": True, "assets": len(ASSET_ROWS), "uniqueIds": len(ASSET_BY_ID), "loopbackOnly": True}); return
        if path.startswith("/media/"):
            asset_id = unquote(path.removeprefix("/media/"))
            if asset_id not in ASSET_BY_ID: self.send_error(HTTPStatus.NOT_FOUND); return
            preview = PREVIEWS / f"{asset_id}.jpg"
            fallback = THUMBNAILS / f"{asset_id}.jpg"
            self.send_file(preview if preview.exists() else fallback, "image/jpeg"); return
        if path.startswith("/video/"):
            asset_id = unquote(path.removeprefix("/video/")); asset = ASSET_BY_ID.get(asset_id)
            if not asset or asset["asset_kind"] != "standalone_video": self.send_error(HTTPStatus.NOT_FOUND); return
            self.send_file(SOURCE / asset["primary_filename"], "video/quicktime"); return
        file_path = STATIC / ("index.html" if path in {"/", ""} else path.lstrip("/"))
        try: file_path.resolve().relative_to(STATIC.resolve())
        except ValueError: self.send_error(HTTPStatus.FORBIDDEN); return
        self.send_file(file_path)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/curation": self.send_error(HTTPStatus.NOT_FOUND); return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 16_384: raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(length))
            self.send_json(save_action(payload))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:
            self.send_json({"ok": False, "error": f"Unable to save: {error}"}, HTTPStatus.INTERNAL_SERVER_ERROR)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=3210)
    parser.add_argument("--no-open", action="store_true", help="Do not open the local URL in the default browser")
    args = parser.parse_args()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not MANIFEST.exists(): atomic_write(MANIFEST, empty_manifest())
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    url = f"http://127.0.0.1:{args.port}/"
    print(f"Synergetic Human Photo Curation\n{url}\nManifest: {MANIFEST}\nPress Ctrl+C to stop.")
    if not args.no_open:
        import webbrowser
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()


if __name__ == "__main__": main()
