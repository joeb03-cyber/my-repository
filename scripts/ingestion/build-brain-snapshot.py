#!/usr/bin/env python3
"""Build deterministic Brain JSONL tables and Library read models from staged Books data."""

from __future__ import annotations

import hashlib
import json
import math
import re
import sys
import unicodedata
import uuid
from collections import Counter, defaultdict
from pathlib import Path

if len(sys.argv) != 5:
    raise SystemExit("Usage: build-brain-snapshot.py <inventory.json> <corpus-dir> <public-cover-dir> <brain-output-dir>")

inventory_path, corpus_dir, cover_dir, output_dir = map(Path, sys.argv[1:])
inventory = json.loads(inventory_path.read_text())
parser_manifest = json.loads((corpus_dir / "parser-corpus-manifest.v2.json").read_text())
incomplete_manifest = json.loads((corpus_dir / "incomplete-books.v1.json").read_text())
metadata_manifest = json.loads((corpus_dir / "metadata-corpus-manifest.v1.json").read_text())
output_dir.mkdir(parents=True, exist_ok=True)
details_dir = output_dir / "books"
tables_dir = output_dir / "import-v1"
details_dir.mkdir(parents=True, exist_ok=True)
tables_dir.mkdir(parents=True, exist_ok=True)

NAMESPACE = uuid.UUID("a79d6c62-f2da-5e47-92a2-a0fb036c0b61")
IMPORT_VERSION = "books-brain-v1/parser-0.2.0"
PUBLIC_CONTENT_KINDS = {"highlight", "summary", "note", "list_item", "exercise"}
STRUCTURE_KINDS = {"chapter_label", "section_label"}

TAXONOMY = [
    ("consciousness-nonduality", "Consciousness & Nonduality", ["consciousness", "awareness", "nondual", "nonduality", "awakening", "awakened", "headless", "ego", "presence", "enlightenment"]),
    ("spirituality-mysticism", "Spirituality & Mysticism", ["spiritual", "mysticism", "mystical", "divine", "sacred", "soul", "prayer", "christ", "miracle", "saint", "infinite way"]),
    ("meditation-practice", "Meditation & Practice", ["meditation", "mindfulness", "zazen", "zen", "contemplation", "breathwork", "yoga", "kundalini", "practice"]),
    ("psychology-trauma-inner-work", "Psychology, Trauma & Inner Work", ["psychology", "subconscious", "belief", "inner child", "parts work", "internal family", "shadow", "identity", "habit", "self therapy", "trauma", "nervous system", "polyvagal", "psychophysiologic", "somatic", "chronic pain", "body says no", "stress response"]),
    ("health-longevity", "Health, Biology & Longevity", ["health", "longevity", "cellular", "nutrition", "sleep", "testosterone", "estrogen", "brain health", "vitality", "disease", "biological"]),
    ("energy-esoteric-healing", "Energy & Esoteric Healing", ["energy healing", "biofield", "frequency", "reiki", "chakra", "alchemy", "vibration", "intuition", "body deva", "radiation"]),
    ("love-relationships", "Love & Relationships", ["love", "relationship", "intimacy", "communication", "attachment", "marriage", "mother", "loving"]),
    ("creativity-purpose-work", "Creativity, Purpose & Work", ["creativity", "creative", "artist", "purpose", "calling", "vocation", "genius", "deep work", "career"]),
    ("money-business-performance", "Money, Business & Performance", ["money", "business", "wealth", "prosperity", "offer", "marketing", "performance", "entrepreneur", "accomplishment", "success"]),
    ("philosophy-meaning", "Philosophy & Meaning", ["philosophy", "truth", "meaning", "freedom", "being", "insecurity", "orthodoxy", "existence", "human condition"]),
    ("reality-metaphysics", "Reality & Metaphysics", ["reality", "subjectivity", "metaphysics", "ontology", "simulation", "manifestation", "reality creation"]),
    ("travel-place-freedom", "Travel, Place & Freedom", ["travel", "place", "vagabond", "vagabonding", "pilgrimage", "nomad", "dirtbag", "journey"]),
    ("society-culture-systems", "Society, Culture & Systems", ["society", "culture", "civilization", "technology", "media", "politics", "system", "religion of the future"]),
]


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))


def normalize(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def json_hash(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def write_jsonl(name: str, rows: list[dict]) -> str:
    path = tables_dir / f"{name}.jsonl"
    path.write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows))
    return hashlib.sha256(path.read_bytes()).hexdigest()


def topic_scores(title: str, units: list[dict]) -> list[dict]:
    title_text = normalize(title)
    body_text = normalize(" ".join(unit["text"] for unit in units if unit["kind"] in PUBLIC_CONTENT_KINDS))
    scored = []
    for slug, label, phrases in TAXONOMY:
        title_hits = [phrase for phrase in phrases if normalize(phrase) in title_text]
        body_counts = {phrase: body_text.count(normalize(phrase)) for phrase in phrases if body_text.count(normalize(phrase))}
        score = 4.5 * len(title_hits) + sum(min(2.4, math.log1p(count)) for count in body_counts.values())
        if score < 3.0:
            continue
        confidence = min(0.94, 0.42 + score * 0.055)
        scored.append({
            "slug": slug,
            "label": label,
            "confidence": round(confidence, 2),
            "editorialState": "suggested",
            "reasoning": "Global taxonomy phrase evidence from the title and full parsed corpus.",
            "evidenceTerms": sorted(set(title_hits) | set(body_counts), key=lambda phrase: (phrase not in title_hits, -body_counts.get(phrase, 0), phrase))[:6],
        })
    # Primary navigation should remain selective; narrower facets can be added
    # later without making every book appear in four top-level shelves.
    return sorted(scored, key=lambda item: (-item["confidence"], item["label"]))[:2]


def split_people(authors: list[str]) -> list[str]:
    result = []
    for author in authors:
        parts = re.split(r"\s+(?:&|and)\s+", author, flags=re.I)
        result.extend(part.strip() for part in parts if part.strip())
    return list(dict.fromkeys(result))


def formatting_signature(paragraph: dict | None) -> tuple:
    if not paragraph:
        return ()
    runs = [run for run in paragraph.get("runs", []) if run.get("text")]
    emphasis = frozenset((run.get("bold"), run.get("italic"), run.get("underline")) for run in runs)
    return (paragraph.get("style"), paragraph.get("alignment"), emphasis)


def build_passage_groups(book_id: str, reader_units: list[dict], source_record: dict | None) -> list[dict]:
    """Create display groups without changing source/highlight rows."""
    paragraphs = {}
    if source_record:
        for block in source_record["document"]["body_blocks"]:
            candidates = [block] if block["block_type"] == "paragraph" else [paragraph for row in block["rows"] for cell in row["cells"] for paragraph in cell["paragraphs"]]
            for paragraph in candidates:
                paragraphs[paragraph["paragraph_index"]] = paragraph

    source_lookup = {}
    # Source ranges are injected on the private review units later; parsed units
    # supply the lossless source location for every public reader unit here.
    groups = []
    current = None
    prose_run_length = 0
    for unit in reader_units:
        source = unit.pop("_source", None)
        source_lookup[unit["sourceUnitKey"]] = source
        is_structure = unit["kind"] in STRUCTURE_KINDS
        join = False
        confidence = 1.0
        rationale = "structural label"
        if current and not is_structure and current["kind"] == "passage":
            previous = current["units"][-1]
            previous_source = source_lookup.get(previous["sourceUnitKey"])
            adjacent = bool(source and previous_source and source["paragraph_start"] == previous_source["paragraph_end"] + 1)
            same_context = bool(source and previous_source and source["container"] == previous_source["container"] and unit["sectionPath"] == previous["sectionPath"])
            previous_kind, current_kind = previous["kind"], unit["kind"]
            list_kinds = {"list_item", "exercise"}
            prose_kinds = {"highlight", "summary", "note"}
            previous_paragraph = paragraphs.get(previous_source["paragraph_start"]) if previous_source else None
            current_paragraph = paragraphs.get(source["paragraph_start"]) if source else None
            same_format = formatting_signature(previous_paragraph) == formatting_signature(current_paragraph)
            if adjacent and same_context and previous_kind in list_kinds and current_kind in list_kinds:
                join, confidence, rationale = True, 0.96, "adjacent list/exercise units with uninterrupted source structure"
            elif adjacent and same_context and previous_kind in prose_kinds and current_kind in list_kinds and previous["text"].rstrip().endswith((":", "—")):
                join, confidence, rationale = True, 0.9, "introductory prose followed immediately by its list"
            elif adjacent and same_context and previous_kind in prose_kinds and current_kind in prose_kinds and same_format and prose_run_length < 4:
                join, confidence, rationale = True, 0.78, "short uninterrupted prose run with matching source formatting"

        if not join:
            group_id = stable_id("passage-group", f"{book_id}:{unit['sourceUnitKey']}")
            current = {
                "id": group_id,
                "ordinal": len(groups) + 1,
                "kind": "structure" if is_structure else "passage",
                "confidence": confidence,
                "groupingMethod": "structural" if is_structure else "conservative_rules_v1",
                "rationale": rationale if is_structure else "source boundary, structural transition, or insufficient evidence to combine",
                "units": [unit],
            }
            groups.append(current)
            prose_run_length = 1 if unit["kind"] in {"highlight", "summary", "note"} else 0
        else:
            current["units"].append(unit)
            current["confidence"] = min(current["confidence"], confidence)
            current["rationale"] = rationale
            prose_run_length = prose_run_length + 1 if unit["kind"] in {"highlight", "summary", "note"} else 0
    return groups


inventory_hash = hashlib.sha256(inventory_path.read_bytes()).hexdigest()
run_id = stable_id("ingestion-run", f"{IMPORT_VERSION}:{inventory_hash}")
captured_at = parser_manifest["generated_at"]
incomplete_by_position = {item["source_position"]: item for item in incomplete_manifest["records"]}
parsed_by_position = {item["source_position"]: item for item in parser_manifest["records"]}

tables: dict[str, list[dict]] = defaultdict(list)
book_index = []
topic_book_counts = Counter()
review_counts = Counter()

relationship_type_ids = {}
for key, label, inverse in [
    ("authored_by", "Authored by", "Author of"),
    ("about_topic", "About topic", "Topic of"),
    ("related_to", "Related to", "Related to"),
]:
    relationship_type_ids[key] = stable_id("relationship-type", key)
    tables["relationship_types"].append({"id": relationship_type_ids[key], "key": key, "label": label, "inverse_label": inverse, "description": "Books vertical slice relationship type."})

topic_entity_ids = {}
for slug, label, _ in TAXONOMY:
    entity_id = stable_id("entity-topic", slug)
    topic_entity_ids[slug] = entity_id
    tables["entities"].append({"id": entity_id, "kind": "topic", "slug": f"topic-{slug}", "title": label, "summary": None, "visibility": "public", "lifecycle_state": "active", "editorial_state": "unreviewed"})
    tables["topics"].append({"entity_id": entity_id, "description": None, "taxonomy_version": "books-global-v1", "editorial_state": "suggested"})

people_seen = {}
all_source_hashes = []
for source in inventory["records"]:
    position = source["source_position"]
    metadata = json.loads((corpus_dir / "metadata" / f"{position:03d}.metadata.v1.json").read_text())
    canonical = metadata["canonical"]
    slug = metadata["slug"]
    book_id = stable_id("entity-book", f"source-position:{position}")
    incomplete = incomplete_by_position.get(position)
    parsed_item = parsed_by_position.get(position)
    parsed = json.loads((corpus_dir / parsed_item["parsed_record"]).read_text()) if parsed_item else None
    source_record = json.loads((corpus_dir / parsed_item["source_record"]).read_text()) if parsed_item else None
    units = parsed["units"] if parsed else []
    topics = topic_scores(f"{canonical['title']} {canonical.get('subtitle') or ''}", units)
    for topic in topics:
        topic_book_counts[topic["slug"]] += 1

    import_state = "complete" if parsed else "incomplete"
    lifecycle_state = "active" if parsed else "incomplete"
    entity_review = "needs_review" if incomplete or metadata["match"]["status"] in {"source_only", "high_confidence_partial"} else "unreviewed"
    tables["entities"].append({"id": book_id, "kind": "book", "slug": slug, "title": canonical["title"], "summary": None, "visibility": "public", "lifecycle_state": lifecycle_state, "editorial_state": entity_review})

    cover = metadata.get("cover") if metadata.get("cover") and metadata["cover"].get("status") == "cached" else None
    cover_id = None
    if cover:
        cover_id = stable_id("media-cover", f"book:{position}:{cover['sha256']}")
        tables["media_assets"].append({
            "id": cover_id, "kind": "book_cover", "storage_path": cover["public_path"], "source_url": cover.get("source_url"),
            "provider": cover.get("provider"), "provider_identifier": str(cover.get("provider_id") or position), "mime_type": cover.get("mime_type"),
            "byte_size": cover.get("bytes"), "width": cover.get("width"), "height": cover.get("height"), "sha256": cover.get("sha256"),
            "confidence": metadata["match"]["score"], "editorial_state": "unreviewed", "provenance": {"amazon_scraped": False, "metadata_status": metadata["match"]["status"]},
        })
    else:
        review_counts["missing_cover"] += 1

    tables["books"].append({
        "entity_id": book_id, "source_position": position, "original_title": source["title_displayed"], "original_author": source.get("displayed_author"),
        "subtitle": canonical.get("subtitle"), "isbn_10": canonical.get("isbn_10"), "isbn_13": canonical.get("isbn_13"), "publisher": canonical.get("publisher"),
        "publication_date": canonical.get("published_date"), "language_code": None, "cover_asset_id": cover_id,
        "metadata_status": metadata["match"]["status"], "metadata_confidence": metadata["match"]["score"],
        "metadata_provenance": {"candidate": metadata["match"].get("candidate"), "warnings": metadata.get("warnings", []), "source": source},
        "import_state": import_state, "imported_at": captured_at, "import_version": IMPORT_VERSION,
    })

    authors = split_people(canonical.get("authors") or ([source["displayed_author"]] if source.get("displayed_author") else []))
    for author in authors:
        normalized_author = normalize(author)
        person_id = people_seen.get(normalized_author)
        if not person_id:
            person_id = stable_id("entity-person", normalized_author)
            people_seen[normalized_author] = person_id
            person_slug = re.sub(r"[^a-z0-9]+", "-", normalized_author).strip("-")
            tables["entities"].append({"id": person_id, "kind": "person", "slug": f"person-{person_slug}", "title": author, "summary": None, "visibility": "public", "lifecycle_state": "active", "editorial_state": "unreviewed"})
            tables["people"].append({"entity_id": person_id, "display_name": author, "sort_name": None, "normalized_name": normalized_author})
        tables["relationships"].append({"id": stable_id("relationship", f"{book_id}:authored_by:{person_id}"), "from_entity_id": book_id, "relationship_type_id": relationship_type_ids["authored_by"], "to_entity_id": person_id, "confidence": 1.0, "rank": authors.index(author) + 1, "context": {}, "editorial_state": "approved", "valid_from": None, "valid_to": None})

    for topic in topics:
        topic_id = topic_entity_ids[topic["slug"]]
        tables["relationships"].append({"id": stable_id("relationship", f"{book_id}:about_topic:{topic_id}"), "from_entity_id": book_id, "relationship_type_id": relationship_type_ids["about_topic"], "to_entity_id": topic_id, "confidence": topic["confidence"], "rank": topics.index(topic) + 1, "context": {"reasoning": topic["reasoning"], "evidence_terms": topic["evidenceTerms"], "taxonomy_version": "books-global-v1"}, "editorial_state": "suggested", "valid_from": None, "valid_to": None})

    bookshelf_source_id = stable_id("source", "bookshelf-page:notes-books")
    if not any(row["id"] == bookshelf_source_id for row in tables["sources"]):
        tables["sources"].append({"id": bookshelf_source_id, "kind": "bookshelf_page", "external_id": "notes-books", "canonical_url": "https://www.synergetichuman.com/notes/books", "title": "Legacy Books page", "access_state": "available"})

    external_state = "malformed" if (source.get("external_book_url") or "").startswith("hhttps") else "unreviewed"
    if external_state == "malformed":
        review_counts["malformed_external_link"] += 1
    if source.get("external_book_url"):
        tables["external_links"].append({"id": stable_id("external-link", f"{book_id}:retail:{source['external_book_url']}"), "entity_id": book_id, "link_type": "retail_reference", "url": source["external_book_url"], "label": "Original external reference", "is_original_source": True, "validation_state": external_state, "provenance": {"source_position": position}})
    metadata_candidate = metadata["match"].get("candidate") or {}
    if metadata_candidate.get("info_url"):
        info_url = metadata_candidate["info_url"]
        tables["external_links"].append({"id": stable_id("external-link", f"{book_id}:provider:{info_url}"), "entity_id": book_id, "link_type": "provider_record", "url": info_url, "label": "Book information", "is_original_source": False, "validation_state": "valid", "provenance": {"provider": metadata_candidate.get("provider")}})

    source_id = None
    source_version_id = None
    if source.get("highlights_url"):
        document_match = re.search(r"/document/d/([^/]+)", source["highlights_url"])
        document_id = document_match.group(1) if document_match else f"position-{position}"
        source_id = stable_id("source", f"google-doc:{document_id}")
        tables["sources"].append({"id": source_id, "kind": "google_doc", "external_id": document_id, "canonical_url": source["highlights_url"], "title": f"{source['title_displayed']} highlights", "access_state": incomplete["state"] if incomplete else "available"})
        tables["external_links"].append({"id": stable_id("external-link", f"{book_id}:highlights:{source['highlights_url']}"), "entity_id": book_id, "link_type": "source_highlights", "url": source["highlights_url"], "label": "Source highlights", "is_original_source": True, "validation_state": "valid" if not incomplete else "unreviewed", "provenance": {"google_doc_id": document_id}})
    if source_record and source_id:
        source_hash = source_record["document"]["export_sha256"]
        all_source_hashes.append(source_hash)
        source_version_id = stable_id("source-version", f"{source_id}:{source_hash}")
        tables["source_versions"].append({"id": source_version_id, "source_id": source_id, "content_hash": source_hash, "export_format": "docx", "parser_version": "0.2.0", "captured_at": captured_at, "raw_snapshot_path": parsed_item["source_record"], "source_metadata": {"export_bytes": source_record["document"]["export_bytes"], "paragraph_count": source_record["document"]["paragraph_count_including_empty_and_tables"], "source_order_preserved": True}})

    review_units = []
    reader_units = []
    passage_groups = []
    content_count = 0
    possible_summary_count = 0
    if parsed and source_version_id:
        for unit in units:
            unit_key = unit["unit_id"]
            fragment_id = stable_id("source-fragment", f"{source_version_id}:{unit_key}")
            highlight_id = stable_id("entity-highlight", f"{book_id}:{unit_key}")
            source_range = unit["source_range"]
            tables["source_fragments"].append({"id": fragment_id, "source_version_id": source_version_id, "fragment_key": unit_key, "ordinal": unit["ordinal"], "raw_text": unit["text"], "normalized_text": " ".join(unit["text"].split()), "paragraph_start": source_range["paragraph_start"], "paragraph_end": source_range["paragraph_end"], "body_block_start": source_range["body_block_start"], "body_block_end": source_range["body_block_end"], "container": source_range["container"], "formatting": unit["formatting"]})
            review_state = "needs_review" if unit["requires_review"] else "unreviewed"
            public_eligible = unit.get("public_eligible", unit["kind"] != "possible_personal_summary")
            tables["entities"].append({"id": highlight_id, "kind": "highlight", "slug": f"{slug}-{unit_key}", "title": unit["text"][:160], "summary": None, "visibility": "public" if public_eligible else "private", "lifecycle_state": "active", "editorial_state": review_state})
            tables["highlights"].append({"entity_id": highlight_id, "book_id": book_id, "source_fragment_id": fragment_id, "source_unit_key": unit_key, "ordinal": unit["ordinal"], "text": unit["text"], "content_kind": unit["kind"], "section_path": unit["section_path"], "locator": unit["locator"], "classification_confidence": unit["classification_confidence"], "classification_reason": unit["classification_reason"], "review_state": review_state, "public_eligible": public_eligible, "standout_rank": None, "imported_at": captured_at, "import_version": IMPORT_VERSION})
            tables["provenance_links"].append({"id": stable_id("provenance", f"{highlight_id}:{fragment_id}"), "entity_id": highlight_id, "relationship_id": None, "source_fragment_id": fragment_id, "source_version_id": source_version_id, "role": "imported_from", "confidence": 1.0, "context": {"source_unit_key": unit_key}})
            read_unit = {"id": highlight_id, "sourceUnitKey": unit_key, "ordinal": unit["ordinal"], "text": unit["text"], "kind": unit["kind"], "sectionPath": unit["section_path"], "locator": unit["locator"], "standoutRank": None, "listStyle": "numbered" if unit["formatting"].get("numbering") else "literal", "_source": source_range}
            if unit["kind"] in STRUCTURE_KINDS or (unit["kind"] in PUBLIC_CONTENT_KINDS and public_eligible):
                reader_units.append(read_unit)
            if unit["kind"] in PUBLIC_CONTENT_KINDS and public_eligible:
                content_count += 1
            if unit["requires_review"]:
                review_units.append({**read_unit, "classificationConfidence": unit["classification_confidence"], "classificationReason": unit["classification_reason"], "sourceRange": source_range, "publicEligible": public_eligible})
                review_counts[f"parser_{unit['kind']}"] += 1
            if unit["kind"] == "possible_personal_summary":
                possible_summary_count += 1
                review_counts["possible_personal_summary"] += 1

        passage_groups = build_passage_groups(book_id, reader_units, source_record)
        for group in passage_groups:
            if group["kind"] != "passage":
                continue
            tables["passage_groups"].append({
                "id": group["id"], "book_id": book_id, "ordinal": group["ordinal"],
                "grouping_method": group["groupingMethod"], "confidence": group["confidence"],
                "review_state": "needs_review" if group["confidence"] < 0.8 and len(group["units"]) > 1 else "unreviewed",
                "rationale": group["rationale"], "import_version": IMPORT_VERSION,
            })
            for member_ordinal, member in enumerate(group["units"], 1):
                tables["passage_group_members"].append({
                    "passage_group_id": group["id"], "highlight_id": member["id"],
                    "ordinal": member_ordinal, "source_unit_key": member["sourceUnitKey"],
                })

    if incomplete:
        review_counts[incomplete["issue_type"]] += 1
        tables["ingestion_issues"].append({"id": stable_id("ingestion-issue", f"{run_id}:{position}:{incomplete['issue_type']}"), "ingestion_run_id": run_id, "entity_id": book_id, "source_id": source_id, "issue_type": incomplete["issue_type"], "severity": "warning", "status": "open", "message": incomplete["message"], "context": {"source_position": position, "highlights_url": source.get("highlights_url")}})
    if metadata["match"]["status"] == "source_only":
        review_counts["metadata_source_only"] += 1
    elif metadata["match"]["status"] == "high_confidence_partial":
        review_counts["metadata_partial"] += 1

    detail = {
        "schemaVersion": "brain-book-detail.v1",
        "id": book_id,
        "slug": slug,
        "sourcePosition": position,
        "title": canonical["title"],
        "originalTitle": source["title_displayed"],
        "subtitle": canonical.get("subtitle"),
        "authors": authors,
        "topics": topics,
        "cover": cover if cover else {"status": "placeholder", "public_path": "/book-covers/placeholder.svg"},
        "importState": import_state,
        "highlightCount": content_count,
        "standouts": [],
        "readerUnits": reader_units,
        "passageGroups": passage_groups,
        "relatedBooks": [],
        "links": {
            "sourceHighlights": source.get("highlights_url"),
            "externalReference": source.get("external_book_url"),
            "providerRecord": metadata_candidate.get("info_url"),
        },
        "review": {
            "metadataStatus": metadata["match"]["status"],
            "metadataConfidence": metadata["match"]["score"],
            "metadataWarnings": metadata.get("warnings", []),
            "candidateMetadata": metadata["match"].get("candidate"),
            "incomplete": incomplete,
            "uncertainUnits": review_units,
            "possiblePersonalSummaryCount": possible_summary_count,
            "source": source,
            "sourceVersion": {"id": source_version_id, "hash": source_record["document"]["export_sha256"] if source_record else None, "parserVersion": "0.2.0"},
        },
    }
    write_json(details_dir / f"{slug}.v1.json", detail)
    book_index.append({
        "id": book_id, "slug": slug, "sourcePosition": position, "title": canonical["title"], "originalTitle": source["title_displayed"],
        "subtitle": canonical.get("subtitle"), "authors": authors, "topics": [{"slug": item["slug"], "label": item["label"], "confidence": item["confidence"], "editorialState": item["editorialState"]} for item in topics],
        "cover": cover if cover else {"status": "placeholder", "public_path": "/book-covers/placeholder.svg"}, "highlightCount": content_count,
        "importState": import_state, "metadataStatus": metadata["match"]["status"], "reviewFlagCount": len(review_units) + (1 if incomplete else 0) + (1 if metadata["match"]["status"] != "catalog_matched" else 0),
    })

tables["ingestion_runs"].append({"id": run_id, "pipeline_name": "synergetic-books", "pipeline_version": IMPORT_VERSION, "source_inventory_hash": inventory_hash, "status": "complete", "started_at": captured_at, "completed_at": captured_at, "counts": {"books": len(book_index), "accessible_docs": len(parsed_by_position), "incomplete_books": len(incomplete_by_position), "content_units": len(tables["highlights"]), "real_covers": sum(item["cover"]["status"] == "cached" for item in book_index)}, "environment": "development"})

taxonomy_output = {
    "schemaVersion": "books-global-topic-taxonomy.v1",
    "approvalState": "all topics and assignments are suggested and editable",
    "method": "A single controlled taxonomy was evaluated across titles and all 157 parsed documents; no per-book category creation was allowed.",
    "topics": [{"id": topic_entity_ids[slug], "slug": slug, "label": label, "bookCount": topic_book_counts[slug], "editorialState": "suggested"} for slug, label, _ in TAXONOMY],
}
write_json(output_dir / "topic-taxonomy.v1.json", taxonomy_output)
write_json(output_dir / "books-index.v1.json", {"schemaVersion": "brain-books-index.v1", "bookCount": len(book_index), "generatedFrom": IMPORT_VERSION, "books": book_index})

table_order = ["entities", "people", "media_assets", "books", "topics", "relationship_types", "relationships", "sources", "source_versions", "source_fragments", "highlights", "passage_groups", "passage_group_members", "external_links", "provenance_links", "ingestion_runs", "ingestion_issues"]
table_manifest = {}
for name in table_order:
    rows = tables[name]
    table_manifest[name] = {"rows": len(rows), "sha256": write_jsonl(name, rows)}

passage_group_sizes = Counter(row["passage_group_id"] for row in tables["passage_group_members"])
display_group_count = sum(len(json.loads(path.read_text())["passageGroups"]) for path in details_dir.glob("*.json"))

manifest = {
    "schemaVersion": "brain-books-import-manifest.v1",
    "importVersion": IMPORT_VERSION,
    "ingestionRunId": run_id,
    "inventoryHash": inventory_hash,
    "sourceContentSetHash": hashlib.sha256("".join(sorted(all_source_hashes)).encode()).hexdigest(),
    "counts": {
        "books": len(book_index), "accessibleDocuments": len(parsed_by_position), "incompleteBooks": len(incomplete_by_position),
        "contentUnits": len(tables["highlights"]), "publicReaderUnits": sum(len(json.loads(path.read_text())["readerUnits"]) for path in details_dir.glob("*.json")),
        "displayPassageGroups": display_group_count,
        "normalizedPassageGroups": len(tables["passage_groups"]),
        "groupedSourceUnits": sum(size for size in passage_group_sizes.values() if size > 1),
        "groupingJoins": sum(size - 1 for size in passage_group_sizes.values() if size > 1),
        "realCovers": sum(item["cover"]["status"] == "cached" for item in book_index), "placeholderCovers": sum(item["cover"]["status"] != "cached" for item in book_index),
        "possiblePersonalSummaries": review_counts["possible_personal_summary"], "standouts": 0,
    },
    "reviewFlags": dict(sorted(review_counts.items())),
    "tables": table_manifest,
    "idempotency": {"strategy": "UUIDv5 identifiers from stable source keys plus unique database constraints", "safeToRegenerate": True, "standoutSuggestionsGenerated": False},
    "productionWrites": False,
}
write_json(output_dir / "import-manifest.v1.json", manifest)
print(json.dumps(manifest["counts"] | {"reviewFlagTypes": len(manifest["reviewFlags"]), "topicCount": len(TAXONOMY)}, indent=2))
