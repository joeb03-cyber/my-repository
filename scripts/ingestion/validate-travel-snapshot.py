#!/usr/bin/env python3
"""Fail closed if staged travel artifacts drift from source or privacy rules."""
import hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = json.loads((ROOT / "data/brain/travel/travel-source-inventory.v1.json").read_text())
timeline = json.loads((ROOT / "data/brain/travel/travel-timeline.v1.json").read_text())
manifest = json.loads((ROOT / "data/brain/travel/import-v1/manifest.json").read_text())

assert source["record_count"] == 101
assert source["candidate_place_reference_count"] == 111
assert [record["source_position"] for record in source["records"]] == list(range(1, 102))
assert timeline["stats"] == {"sourceRecords":101,"visits":110,"movements":1,"uniquePlaces":103,"countries":42,"resolvedPlaces":90,"unresolvedPlaces":13}
assert len(timeline["places"]) == 103 and len(timeline["visits"]) == 110
assert all((place["latitude"] is None) == (place["longitude"] is None) for place in timeline["places"])
assert all("day" not in visit["start"] and "day" not in visit["end"] for visit in timeline["visits"])
cross_year = next(visit for visit in timeline["visits"] if visit["sourceRawLine"] == "* dec-feb: buenos aires")
assert cross_year["start"] == {"year":2023,"month":12} and cross_year["end"] == {"year":2024,"month":2}
assert timeline["review"]["currentLocationConflict"]["decision"] == "unresolved_do_not_overwrite_now"
assert timeline["movements"][0]["source_raw_line"] == "* sept: left austin"
for table, expected in manifest["counts"].items():
    path = ROOT / f"data/brain/travel/import-v1/{table}.jsonl"
    rows = [line for line in path.read_text().splitlines() if line]
    assert len(rows) == expected
    assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest["artifact_hashes"][table]
migration = (ROOT / "supabase/migrations/20260827160000_brain_travel_photos_v1.sql").read_text()
public_photo_view = migration.split("create or replace view public.brain_public_photos",1)[1].split(";",1)[0]
assert "exact_latitude" not in public_photo_view and "exact_longitude" not in public_photo_view and "raw_safe_exif" not in public_photo_view and "original_source_path" not in public_photo_view
print(json.dumps({"status":"valid","source_records":101,"visits":110,"places":103,"countries":42,"resolved_places":90,"photo_gps_public":False}))
