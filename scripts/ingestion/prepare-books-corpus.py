#!/usr/bin/env python3
"""Create the full accessible selection and explicit incomplete-book records."""

import json
import sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("Usage: prepare-books-corpus.py <inventory.json> <audit.json> <output-dir>")

inventory_path, audit_path, output_dir = map(Path, sys.argv[1:])
inventory = json.loads(inventory_path.read_text())
audit = json.loads(audit_path.read_text())
output_dir.mkdir(parents=True, exist_ok=True)
accessible = sorted(item["source_position"] for item in audit["results"] if item["publicly_exportable"])
audit_by_position = {item["source_position"]: item for item in audit["results"]}

selection = {
    "schema_version": "bookshelf-corpus-selection.v1",
    "source_inventory": str(inventory_path),
    "source_audit": str(audit_path),
    "selection_count": len(accessible),
    "source_positions": accessible,
    "manifest_schema_version": "bookshelf-parser-corpus-manifest.v2",
    "manifest_file": "parser-corpus-manifest.v2.json",
    "constraints": {"supabase_writes": False, "deployment": False, "public_exports_only": True},
}

incomplete = []
for record in inventory["records"]:
    if not record.get("highlights_url"):
        state, issue = "missing", "no_highlight_document"
    elif record["source_position"] not in accessible:
        state, issue = "viewer_required", "google_doc_viewer_access_required"
    else:
        continue
    audit_record = audit_by_position.get(record["source_position"])
    incomplete.append({
        "source_position": record["source_position"],
        "title_displayed": record["title_displayed"],
        "displayed_author": record.get("displayed_author"),
        "highlights_url": record.get("highlights_url"),
        "state": state,
        "issue_type": issue,
        "audit_http_status": audit_record.get("anomalous_response_verification", {}).get("http_status") if audit_record else None,
        "message": "Google Doc requires Viewer access" if state == "viewer_required" else "No highlight document is linked from the source bookshelf",
    })

(output_dir / "corpus-selection.v1.json").write_text(json.dumps(selection, indent=2, ensure_ascii=False) + "\n")
(output_dir / "incomplete-books.v1.json").write_text(json.dumps({
    "schema_version": "bookshelf-incomplete-books.v1",
    "record_count": len(incomplete),
    "records": incomplete,
}, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"accessible": len(accessible), "incomplete": len(incomplete)}, indent=2))
