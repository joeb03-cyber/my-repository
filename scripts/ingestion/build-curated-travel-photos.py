#!/usr/bin/env python3
"""Build private Stage 4 photo/visit snapshots without publishing or uploading.

The source inventory and curation manifest remain authoritative. This script
creates an editorial relationship overlay; it never rewrites EXIF or travel
chronology.
"""

from __future__ import annotations

import argparse
import collections
import json
import uuid
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVENTORY = ROOT / "artifacts/photo-inventory/raw-export-v1/logical-assets.private.jsonl"
CURATION = ROOT / "artifacts/photo-curation/stage2/curation-manifest.private.json"
COVERAGE = ROOT / "artifacts/photo-inventory/raw-export-v1/travel-coverage.private.json"
TIMELINE = ROOT / "data/brain/travel/travel-timeline.v1.json"
CORRECTIONS = ROOT / "data/brain/travel/editorial-route-corrections.v1.json"
LIFETIME = ROOT / "data/brain/editorial-updates/2026-08-28-stage17.v1.json"
DEFAULT_OUTPUT = ROOT / "artifacts/photo-curation/stage4"
TRAVEL_NAMESPACE = uuid.UUID("cd16dcf0-a399-4c71-93bc-abaf07f31a65")

# These are locality-to-anchor equivalences supported by Joe's chronology and
# the photo GPS labels. They do not assert a new destination or exact route.
LOCALITY_ANCHORS = {
    "General Luna": "siargao",
    "San Isidro": "siargao",
    "Dapa": "siargao",
    "Pecatu": "bali",
    "Banjar Desa": "bali",
    "Banjar Kerobokan": "bali",
    "Banjar Pasekan": "bali",
    "Kangin": "bali",
    "Banjar Negari": "bali",
    "Gianyar": "bali",
    "Belimbingdesa": "bali",
    "Ubud": "bali",
    "Banjar Swastika": "bali",
    "Banjar Tebongkang": "bali",
    "Neihu": "taiwan",
    "Jiufen": "taiwan",
    "Catania": "sicily",
    "Taormina": "sicily",
    "Palermo": "sicily",
    "Cefalù": "sicily",
    "Sanxenxo": "galicia",
    "Sandy Bay": "roatan",
    "Palm Beach": "aruba",
}

COUNTRY_NAMES = {
    "Britain (UK)": "United Kingdom",
    "Bosnia & Herzegovina": "Bosnia and Herzegovina",
    "XK": "Kosovo",
}


def read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def month_number(year: int, month: int) -> int:
    return year * 12 + month


def capture_day(asset: dict) -> str | None:
    parts = asset.get("capture_parts") or []
    if len(parts) < 3:
        return None
    try:
        return date(parts[0], parts[1], parts[2]).isoformat()
    except ValueError:
        return None


def displayed_dimensions(asset: dict) -> tuple[int | None, int | None, str]:
    width, height = asset.get("width"), asset.get("height")
    if width and height and asset.get("orientation") in {5, 6, 7, 8}:
        width, height = height, width
    if not width or not height:
        return width, height, "unknown"
    return width, height, "landscape" if width > height else "portrait" if height > width else "square"


def load_visits() -> tuple[list[dict], dict[str, dict], dict[str, list[dict]]]:
    timeline = json.loads(TIMELINE.read_text())
    places = {place["id"]: place for place in timeline["places"]}
    visits = [dict(visit) for visit in timeline["visits"]]
    correction = json.loads(CORRECTIONS.read_text())["corrections"][0]
    for visit in visits:
        if visit["chronologyIndex"] >= correction["visit"]["chronologyIndex"]:
            visit["chronologyIndex"] += 1

    coverage = json.loads(COVERAGE.read_text())["visits"]
    place = correction["place"]
    # Match the deterministic identifiers used by the reviewed staging route
    # correction import. Never mint local-only identifiers for public links.
    place_id = str(uuid.uuid5(TRAVEL_NAMESPACE, "travel-place:vaduz"))
    places[place_id] = {
        "id": place_id,
        "slug": place["slug"],
        "sourceName": place["sourceName"],
        "name": place["name"],
        "placeType": place["placeType"],
        "countryCode": place["countryCode"],
        "countryName": place["countryName"],
        "latitude": place["latitude"],
        "longitude": place["longitude"],
        "coordinatesState": place["coordinatesState"],
        "reviewState": "approved",
    }
    cv = correction["visit"]
    visits.append({
        "id": str(uuid.uuid5(TRAVEL_NAMESPACE, "travel-visit:vaduz:2026-05:joe-direct")),
        "placeId": place_id,
        "visitKind": cv["visitKind"],
        "sourcePosition": cv["sourcePosition"],
        "groupPosition": cv["groupPosition"],
        "chronologyIndex": cv["chronologyIndex"],
        "start": {"year": cv["startYear"], "month": cv["startMonth"]},
        "end": {"year": cv["endYear"], "month": cv["endMonth"]},
        "temporalPrecision": cv["temporalPrecision"],
        "sourceDateText": cv["sourceDateText"],
        "sourceValue": cv["sourceValue"],
        "sourceRawLine": cv["sourceRawLine"],
        "reviewState": "approved",
    })
    visits.sort(key=lambda item: item["chronologyIndex"])
    by_id = {}
    by_slug: dict[str, list[dict]] = collections.defaultdict(list)
    for visit in visits:
        canonical = {**visit, "place": places[visit["placeId"]]}
        by_id[visit["id"]] = canonical
        by_slug[canonical["place"]["slug"]].append(canonical)
    return visits, by_id, by_slug


def closest_visit(candidates: list[dict], asset: dict) -> tuple[dict | None, str]:
    parts = asset.get("capture_parts") or []
    if not candidates:
        return None, "no_candidate"
    if len(candidates) == 1:
        return candidates[0], "unique_place_visit"
    if len(parts) < 2:
        return None, "multiple_visits_without_capture_month"
    target = month_number(parts[0], parts[1])
    ranked = sorted(
        ((abs(target - month_number(v["start"]["year"], v["start"]["month"])), v) for v in candidates),
        key=lambda item: (item[0], item[1]["chronologyIndex"]),
    )
    if len(ranked) > 1 and ranked[0][0] == ranked[1][0]:
        return None, "equidistant_repeated_place_visits"
    return ranked[0][1], "nearest_repeated_place_visit"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    inventory = {row["logical_asset_id"]: row for row in read_jsonl(INVENTORY)}
    curation = json.loads(CURATION.read_text())
    visits, visit_by_id, visits_by_slug = load_visits()
    decisions = curation["assets"]
    keep_ids = [asset_id for asset_id, decision in decisions.items() if decision.get("publicationStatus") == "keep"]
    photos, private_rows, reconciliation = [], [], []

    for asset_id in keep_ids:
        asset = inventory[asset_id]
        decision = decisions[asset_id]
        assigned = asset.get("visit_assignment")
        visit = visit_by_id.get(assigned.get("visit_id")) if assigned else None
        relationship_state = assigned.get("state") if assigned else None
        method = assigned.get("basis") if assigned else None
        source_place = asset.get("nearest_travel_place")
        locality = (asset.get("nearest_geonames") or {}).get("city")

        if not visit and source_place:
            visit, reason = closest_visit(visits_by_slug.get(source_place["place_slug"], []), asset)
            if visit:
                relationship_state = "editorial_confident"
                method = reason
        if not visit and locality in LOCALITY_ANCHORS:
            visit, reason = closest_visit(visits_by_slug.get(LOCALITY_ANCHORS[locality], []), asset)
            if visit:
                relationship_state = "editorial_confident"
                method = f"locality_to_travel_anchor:{reason}"

        nearest = asset.get("nearest_geonames") or {}
        display_place = locality or (source_place or {}).get("place_name")
        country = COUNTRY_NAMES.get(nearest.get("country"), nearest.get("country")) or (source_place or {}).get("country")
        if visit:
            country = visit["place"]["countryName"]
            # Exact localities can remain visible while the journey groups by anchor.
            display_place = display_place or visit["place"]["name"]
        width, height, orientation = displayed_dimensions(asset)
        captured = capture_day(asset)
        capture_parts = asset.get("capture_parts") or []
        has_motion = asset["asset_kind"] == "live_photo"
        storage_base = f"travel-photos/{asset_id}"
        photo = {
            "id": asset_id,
            "captureDate": captured,
            "capturedYear": capture_parts[0] if capture_parts else None,
            "capturedMonth": capture_parts[1] if len(capture_parts) > 1 else None,
            "datePrecision": "day" if captured else "month" if len(capture_parts) > 1 else None,
            "width": width,
            "height": height,
            "orientation": orientation,
            "visitId": visit["id"] if visit else None,
            "placeId": visit["placeId"] if visit else None,
            "visitPlace": visit["place"]["name"] if visit else None,
            "displayPlace": display_place,
            "country": country,
            "relationshipState": relationship_state or "unresolved",
            "relationshipMethod": method or "none",
            "wallpaper": bool(decision.get("wallpaper")),
            "mediaKind": "live_photo" if has_motion else "still_photo",
            "hasPrivateMotion": has_motion,
            "derivatives": {
                "small": {"storagePath": f"{storage_base}/small.webp", "width": 480},
                "medium": {"storagePath": f"{storage_base}/medium.webp", "width": 1024},
                "large": {"storagePath": f"{storage_base}/large.webp", "width": 1800},
            },
        }
        photos.append(photo)
        reconciliation.append({
            "assetId": asset_id,
            "sourceRelationship": assigned or source_place or nearest or None,
            "resolvedVisitId": photo["visitId"],
            "resolvedVisit": photo["visitPlace"],
            "state": photo["relationshipState"],
            "method": photo["relationshipMethod"],
        })
        private_rows.append({
            "assetId": asset_id,
            "sourceFiles": asset.get("source_files", []),
            "primaryFilename": asset["primary_filename"],
            "primarySha256": asset["primary_sha256"],
            "captureAtRaw": asset.get("capture_at"),
            "exactGps": {"latitude": asset.get("latitude"), "longitude": asset.get("longitude"), "altitude": asset.get("altitude")},
            "pairing": asset.get("pairing"),
            "resolvedVisitId": photo["visitId"],
            "relationshipState": photo["relationshipState"],
            "relationshipMethod": photo["relationshipMethod"],
        })

    photos.sort(key=lambda item: (item["captureDate"] or "9999-99-99", item["id"]))
    lifetime = json.loads(LIFETIME.read_text())["travelDirection"]
    current_location = json.loads(TIMELINE.read_text()).get("currentState", {}).get("location")
    recent_names = {item["place"]["countryName"] for item in visit_by_id.values()}
    if current_location and current_location.get("country_name"):
        recent_names.add(current_location["country_name"])
    recent = sorted(recent_names)
    lifetime_countries = sorted(set(recent) | set(lifetime["pre2023CountriesSupplied"]))
    visit_photo_counts = collections.Counter(photo["visitId"] for photo in photos if photo["visitId"])
    safe_visits = []
    for item in sorted(visit_by_id.values(), key=lambda value: value["chronologyIndex"]):
        place = item["place"]
        safe_visits.append({
            "id": item["id"], "chronologyIndex": item["chronologyIndex"],
            "placeId": item["placeId"], "place": place["name"], "country": place["countryName"],
            "latitude": place.get("latitude"), "longitude": place.get("longitude"),
            "start": item["start"], "end": item["end"], "sourceDateText": item.get("sourceDateText"),
            "photoCount": visit_photo_counts[item["id"]],
        })

    counts = collections.Counter(photo["relationshipState"] for photo in photos)
    public_snapshot = {
        "schemaVersion": "synergetic-lived-history.v1",
        "generatedFrom": {
            "curationRevision": curation["revision"],
            "sourceInventorySha256": curation["sourceInventory"]["sha256"],
            "travelChronologyVisits": len(safe_visits),
        },
        "stats": {
            "photos": len(photos), "wallpapers": sum(photo["wallpaper"] for photo in photos),
            "visits": len(safe_visits), "visitsWithPhotos": len(visit_photo_counts),
            "lifetimeCountries": lifetime["reconciledKnownLifetimeCount"],
            "recentCountries": len(recent), "relationshipStates": dict(counts),
        },
        "journeyStart": "2023-09",
        "lifetimeCountries": lifetime_countries,
        "currentLocation": current_location,
        "visits": safe_visits,
        "photos": photos,
    }
    (args.output / "public-photo-snapshot.private.json").write_text(json.dumps(public_snapshot, ensure_ascii=False, indent=2) + "\n")
    (args.output / "photo-import.private.json").write_text(json.dumps({"schemaVersion": "synergetic-photo-import.private.v1", "assets": private_rows}, ensure_ascii=False, indent=2) + "\n")
    unresolved = [item for item in reconciliation if item["resolvedVisitId"] is None]
    (args.output / "reconciliation.private.json").write_text(json.dumps({
        "schemaVersion": "synergetic-photo-reconciliation.v1",
        "counts": {"photos": len(photos), "resolved": len(photos) - len(unresolved), "unresolved": len(unresolved), "states": dict(counts)},
        "unresolved": unresolved,
        "records": reconciliation,
    }, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(public_snapshot["stats"] | {"unresolved": len(unresolved)}, indent=2))


if __name__ == "__main__":
    main()
