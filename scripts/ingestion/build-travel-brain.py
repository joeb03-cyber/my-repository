#!/usr/bin/env python3
"""Build the public travel read model and idempotent staging import artifacts."""

from __future__ import annotations

import hashlib, json, re, unicodedata, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = ROOT / "data/brain/travel/travel-source-inventory.v1.json"
PLACES_PATH = ROOT / "data/brain/travel/place-candidates.v1.json"
DECISIONS_PATH = ROOT / "data/brain/travel/editorial-decisions.v1.json"
OUTPUT = ROOT / "data/brain/travel/travel-timeline.v1.json"
IMPORT_ROOT = ROOT / "data/brain/travel/import-v1"
NAMESPACE = uuid.UUID("7f790137-c94e-42db-baa0-3c6bd179df41")
COUNTRIES = {
    "AL":"Albania","AR":"Argentina","AT":"Austria","AW":"Aruba","BG":"Bulgaria","BR":"Brazil","CA":"Canada","CH":"Switzerland","CL":"Chile","CO":"Colombia","DO":"Dominican Republic","EE":"Estonia","ES":"Spain","FI":"Finland","GB":"United Kingdom","GT":"Guatemala","HN":"Honduras","HU":"Hungary","ID":"Indonesia","IT":"Italy","JP":"Japan","KH":"Cambodia","LT":"Lithuania","LV":"Latvia","MA":"Morocco","ME":"Montenegro","MK":"North Macedonia","MX":"Mexico","MY":"Malaysia","PE":"Peru","PH":"Philippines","PL":"Poland","PR":"Puerto Rico","RS":"Serbia","SE":"Sweden","SI":"Slovenia","SV":"El Salvador","TH":"Thailand","TW":"Taiwan","US":"United States","VN":"Vietnam","XK":"Kosovo",
}

def stable_id(kind: str, key: str) -> str: return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))
def slug(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")
def jsonl(path: Path, rows: list[dict]) -> None:
    path.write_text("".join(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n" for row in rows))

def main() -> None:
    inventory = json.loads(INVENTORY_PATH.read_text())
    candidates = json.loads(PLACES_PATH.read_text())
    decisions = json.loads(DECISIONS_PATH.read_text())
    candidate_by_name = {place["source_name"]: place for place in candidates["places"]}
    snapshot_id = stable_id("travel-source-snapshot", inventory["source"]["content_sha256"])

    places = []
    for candidate in candidates["places"]:
        source_name = candidate["source_name"]
        country_code = candidate["country_code_candidate"]
        places.append({
            "id": stable_id("place", source_name.lower()), "slug": slug(source_name), "source_name": source_name,
            "name": candidate["canonical_name_candidate"], "place_type": candidate["place_type_candidate"],
            "country_code": country_code, "country_name": COUNTRIES[country_code],
            "latitude": candidate["latitude"], "longitude": candidate["longitude"],
            "coordinates_state": "provider_candidate" if candidate["latitude"] is not None else "unresolved",
            "visibility": "public", "editorial_state": candidate["review"]["state"],
            "provenance": {"source_label": source_name, "country_assignment": "editorial_decision" if candidate["review"].get("editorial_decision") else "route_context_candidate", "geocoding": candidate["provider"], "review_flags": candidate["review"]["flags"], "editorial_decision": candidate["review"].get("editorial_decision")},
        })
    place_by_source = {place["source_name"]: place for place in places}

    visits, movements = [], []
    chronological_records = sorted(inventory["records"], key=lambda record: -record["source_position"])
    chronology_index = 0
    for record in chronological_records:
        temporal = record["temporal_range"]
        if record["record_kind"] == "departure":
            source_place = record["candidate_places"][0]["source_name"]
            movements.append({
                "id": stable_id("movement", record["id"]), "source_snapshot_id": snapshot_id,
                "origin_place_id": place_by_source[source_place]["id"], "destination_place_id": None,
                "event_kind": "departure", "transport_mode": None,
                "start_year": temporal["start"]["year"], "start_month": temporal["start"]["month"],
                "temporal_precision": temporal["precision"], "source_position": record["source_position"],
                "source_raw_line": record["source_raw_line"], "visibility": "public", "editorial_state": "needs_review",
                "provenance": {"source_record_id": record["id"], "review_flags": record["review"]["flags"]},
            })
            continue
        for candidate in sorted(record["candidate_places"], key=lambda place: place["group_position"]):
            chronology_index += 1
            place = place_by_source[candidate["source_name"]]
            visits.append({
                "id": stable_id("visit", f"{record['id']}:{candidate['group_position']}"),
                "source_snapshot_id": snapshot_id, "place_id": place["id"], "visit_kind": "visit_or_stay_unspecified",
                "source_position": record["source_position"], "group_position": candidate["group_position"], "chronology_index": chronology_index,
                "start_year": temporal["start"]["year"], "start_month": temporal["start"]["month"],
                "end_year": temporal["end"]["year"], "end_month": temporal["end"]["month"],
                "temporal_precision": temporal["precision"], "source_date_text": temporal["source_text"],
                "source_value": record["source_value"], "source_raw_line": record["source_raw_line"],
                "visibility": "public", "editorial_state": "needs_review" if record["review"]["flags"] or place["editorial_state"] == "needs_review" else "unreviewed",
                "provenance": {"source_record_id": record["id"], "source_line": record["source_line"], "record_kind": record["record_kind"], "review_flags": record["review"]["flags"]},
            })

    source_snapshot = {
        "id": snapshot_id, "source_url": inventory["source"]["source_url"], "external_id": inventory["source"]["source_id"],
        "captured_on": inventory["source"]["captured_at"], "content_hash": inventory["source"]["content_sha256"],
        "snapshot_path": inventory["source"]["snapshot_path"], "source_metadata": {"title": inventory["source"]["source_title"], "slug": inventory["source"]["source_slug"], "intro": inventory["intro"], "editorial_decisions": decisions},
    }
    public_places = [{"id": p["id"], "slug": p["slug"], "sourceName": p["source_name"], "name": p["name"], "placeType": p["place_type"], "countryCode": p["country_code"], "countryName": p["country_name"], "latitude": p["latitude"], "longitude": p["longitude"], "coordinatesState": p["coordinates_state"], "reviewState": p["editorial_state"]} for p in places]
    public_visits = [{"id": v["id"], "placeId": v["place_id"], "visitKind": v["visit_kind"], "sourcePosition": v["source_position"], "groupPosition": v["group_position"], "chronologyIndex": v["chronology_index"], "start":{"year":v["start_year"],"month":v["start_month"]}, "end":{"year":v["end_year"],"month":v["end_month"]}, "temporalPrecision":v["temporal_precision"], "sourceDateText":v["source_date_text"], "sourceValue":v["source_value"], "sourceRawLine":v["source_raw_line"], "reviewState":v["editorial_state"]} for v in visits]
    countries = sorted({place["country_name"] for place in places})
    unresolved = [place["source_name"] for place in places if place["latitude"] is None]
    payload = {
        "schemaVersion": "synergetic-travel-timeline.v1", "generatedFrom": inventory["source"]["source_url"],
        "sourceSnapshot": {"id": snapshot_id, "capturedOn": source_snapshot["captured_on"], "contentHash": source_snapshot["content_hash"], "intro": inventory["intro"]},
        "stats": {"sourceRecords": inventory["record_count"], "visits": len(visits), "movements": len(movements), "uniquePlaces": len(places), "countries": len(countries), "resolvedPlaces": len(places)-len(unresolved), "unresolvedPlaces": len(unresolved)},
        "countries": countries, "places": public_places, "visits": public_visits,
        "movements": movements, "currentState": {"location": {**decisions["current_state"]["location"], "provenance": {"authority": decisions["authority"], "recorded_at": decisions["recorded_at"]}}},
        "review": {"unresolvedPlaceLabels": unresolved, "currentLocationResolution": {"chronologyLatest": "warsaw", "approvedNow": "Sarajevo", "decision": "resolved_keep_chronology_and_now_separate"}},
        "mapAttribution": "GeoNames geographical database, CC BY 4.0",
    }
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    IMPORT_ROOT.mkdir(parents=True, exist_ok=True)
    jsonl(IMPORT_ROOT / "travel_source_snapshots.jsonl", [source_snapshot]); jsonl(IMPORT_ROOT / "travel_places.jsonl", places)
    jsonl(IMPORT_ROOT / "travel_visits.jsonl", visits); jsonl(IMPORT_ROOT / "travel_movements.jsonl", movements)
    manifest = {"schema_version":"synergetic-travel-import.v1","source_hash":inventory["source"]["content_sha256"],"counts":{"travel_source_snapshots":1,"travel_places":len(places),"travel_visits":len(visits),"travel_movements":len(movements)},"artifact_hashes":{name:hashlib.sha256((IMPORT_ROOT / f"{name}.jsonl").read_bytes()).hexdigest() for name in ["travel_source_snapshots","travel_places","travel_visits","travel_movements"]}}
    (IMPORT_ROOT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(payload["stats"], indent=2))

if __name__ == "__main__": main()
