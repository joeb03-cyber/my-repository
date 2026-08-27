#!/usr/bin/env python3
"""Refresh derived metadata-manifest cover states after a recovery pass."""

import json
import sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("Usage: refresh-metadata-manifest.py <metadata-dir> <manifest.json> <cover-report.json>")

metadata_dir, manifest_path, report_path = map(Path, sys.argv[1:])
metadata = {}
for path in metadata_dir.glob("*.metadata.v1.json"):
    record = json.loads(path.read_text())
    metadata[record["source_position"]] = record

manifest = json.loads(manifest_path.read_text())
report = json.loads(report_path.read_text())
for record in manifest["records"]:
    cover = metadata[record["source_position"]].get("cover") or {}
    record["cover_status"] = cover.get("status", "placeholder")
manifest["cover_recovery"] = {
    "schema_version": report["schema_version"],
    "generated_at": report["generated_at"],
    "recovered": report["recovered"],
    "report": str(report_path),
}
manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"records": len(manifest["records"]), "cached_covers": sum(record["cover_status"] == "cached" for record in manifest["records"])}, indent=2))
