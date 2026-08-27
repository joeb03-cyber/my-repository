#!/usr/bin/env python3
"""Validate a generated Books Brain snapshot without contacting Supabase."""

from __future__ import annotations

import hashlib
import json
import sys
from collections import Counter
from pathlib import Path


if len(sys.argv) != 3:
    raise SystemExit("Usage: validate-brain-snapshot.py <brain-dir> <public-dir>")

brain_dir = Path(sys.argv[1])
public_dir = Path(sys.argv[2])
manifest = json.loads((brain_dir / "import-manifest.v1.json").read_text())
index = json.loads((brain_dir / "books-index.v1.json").read_text())
tables_dir = brain_dir / "import-v1"
errors: list[str] = []


def require(condition: bool, message: str) -> None:
    if not condition:
        errors.append(message)


def load_table(name: str) -> list[dict]:
    path = tables_dir / f"{name}.jsonl"
    rows = [json.loads(line) for line in path.read_text().splitlines() if line]
    expected = manifest["tables"][name]
    require(len(rows) == expected["rows"], f"{name}: row count differs from manifest")
    require(hashlib.sha256(path.read_bytes()).hexdigest() == expected["sha256"], f"{name}: sha256 differs from manifest")
    if rows and "id" in rows[0]:
        ids = [row["id"] for row in rows]
        require(len(ids) == len(set(ids)), f"{name}: duplicate ids")
    return rows


tables = {name: load_table(name) for name in manifest["tables"]}
entities = {row["id"] for row in tables["entities"]}
books = {row["entity_id"]: row for row in tables["books"]}
sources = {row["id"] for row in tables["sources"]}
source_versions = {row["id"] for row in tables["source_versions"]}
source_fragments = {row["id"]: row for row in tables["source_fragments"]}
highlights = {row["entity_id"]: row for row in tables["highlights"]}
passage_groups = {row["id"]: row for row in tables["passage_groups"]}
relationships = {row["id"] for row in tables["relationships"]}
relationship_types = {row["id"] for row in tables["relationship_types"]}

require(index["bookCount"] == 165 == len(index["books"]) == len(books), "expected exactly 165 books")
require(sorted(row["sourcePosition"] for row in index["books"]) == list(range(1, 166)), "source positions must be exactly 1..165")
require(len(source_versions) == 157, "expected 157 accessible source versions")
require(manifest["counts"]["incompleteBooks"] == 8, "expected eight incomplete books")
require(manifest["reviewFlags"].get("google_doc_viewer_access_required") == 6, "expected six viewer-only Docs")
require(manifest["reviewFlags"].get("no_highlight_document") == 2, "expected two books without Docs")
require(manifest["counts"]["possiblePersonalSummaries"] == 3, "expected three possible personal summaries")
require(manifest["counts"]["standouts"] == 0, "standouts must begin empty")
require(manifest["productionWrites"] is False, "snapshot must state that production was not written")

for row in tables["people"] + tables["topics"]:
    require(row["entity_id"] in entities, f"missing entity for {row['entity_id']}")
for row in tables["books"]:
    require(row["entity_id"] in entities, f"missing book entity for {row['entity_id']}")
    if row.get("cover_asset_id"):
        require(any(asset["id"] == row["cover_asset_id"] for asset in tables["media_assets"]), f"missing cover asset {row['cover_asset_id']}")
for row in tables["relationships"]:
    require(row["from_entity_id"] in entities and row["to_entity_id"] in entities, f"relationship {row['id']} has a missing entity")
    require(row["relationship_type_id"] in relationship_types, f"relationship {row['id']} has a missing type")
for row in tables["source_versions"]:
    require(row["source_id"] in sources, f"source version {row['id']} has a missing source")
for row in tables["source_fragments"]:
    require(row["source_version_id"] in source_versions, f"source fragment {row['id']} has a missing source version")
    require(row["paragraph_start"] <= row["paragraph_end"], f"source fragment {row['id']} has an invalid paragraph range")
for row in tables["highlights"]:
    require(row["entity_id"] in entities and row["book_id"] in books, f"highlight {row['entity_id']} has a missing entity or book")
    require(row["source_fragment_id"] in source_fragments, f"highlight {row['entity_id']} has a missing fragment")
    if row["content_kind"] == "possible_personal_summary":
        require(row["public_eligible"] is False, f"possible summary {row['entity_id']} is public eligible")
for row in tables["provenance_links"]:
    require(row["entity_id"] in entities, f"provenance link {row['id']} has a missing entity")
    require(row["source_fragment_id"] in source_fragments, f"provenance link {row['id']} has a missing fragment")
    require(row["source_version_id"] in source_versions, f"provenance link {row['id']} has a missing source version")
    if row.get("relationship_id"):
        require(row["relationship_id"] in relationships, f"provenance link {row['id']} has a missing relationship")
for row in tables["passage_groups"]:
    require(row["book_id"] in books, f"passage group {row['id']} has a missing book")
for row in tables["passage_group_members"]:
    require(row["passage_group_id"] in passage_groups, f"passage member has a missing group {row['passage_group_id']}")
    require(row["highlight_id"] in highlights, f"passage member has a missing highlight {row['highlight_id']}")
    require(highlights.get(row["highlight_id"], {}).get("source_unit_key") == row["source_unit_key"], f"passage member source key differs for {row['highlight_id']}")

detail_counts = Counter()
reader_source_keys: set[str] = set()
for path in sorted((brain_dir / "books").glob("*.v1.json")):
    detail = json.loads(path.read_text())
    detail_counts[detail["importState"]] += 1
    possible_keys = {unit["sourceUnitKey"] for unit in detail.get("review", {}).get("uncertainUnits", []) if unit["kind"] == "possible_personal_summary"}
    visible_keys = {unit["sourceUnitKey"] for unit in detail["readerUnits"]}
    grouped_keys = [unit["sourceUnitKey"] for group in detail["passageGroups"] for unit in group["units"]]
    reader_source_keys.update(visible_keys)
    require(not (possible_keys & visible_keys), f"{detail['slug']}: possible personal summary leaked into reader")
    require(not detail["standouts"], f"{detail['slug']}: automated standout present")
    require(grouped_keys == [unit["sourceUnitKey"] for unit in detail["readerUnits"]], f"{detail['slug']}: passage grouping changed reader order or membership")
require(detail_counts == Counter({"complete": 157, "incomplete": 8}), "detail completion counts differ from expected")
highlight_source_keys = {row["source_unit_key"] for row in tables["highlights"]}
require(reader_source_keys <= highlight_source_keys, "reader contains units without normalized highlight records")

for asset in tables["media_assets"]:
    cover_path = public_dir / asset["storage_path"].lstrip("/")
    require(cover_path.exists(), f"cover file is missing: {asset['storage_path']}")
    if cover_path.exists():
        require(hashlib.sha256(cover_path.read_bytes()).hexdigest() == asset["sha256"], f"cover hash differs: {asset['storage_path']}")

face = [row for row in index["books"] if row["originalTitle"] == "Face to No Face / On Having No Head"]
require(len(face) == 1 and face[0]["title"] == "Face to No Face / On Having No Head", "Face to No Face identity is not preserved as one book")
all_for_love = [row for row in index["books"] if row["originalTitle"] == "All for Love"]
require(len(all_for_love) == 1 and all_for_love[0]["authors"] == ["Matt Kahn"], "All for Love author identity is incorrect")

result = {
    "valid": not errors,
    "errors": errors,
    "counts": manifest["counts"],
    "tableCount": len(tables),
    "verifiedCoverFiles": len(tables["media_assets"]),
    "verifiedProvenanceLinks": len(tables["provenance_links"]),
    "verifiedPassageGroups": len(tables["passage_groups"]),
}
print(json.dumps(result, indent=2))
raise SystemExit(1 if errors else 0)
