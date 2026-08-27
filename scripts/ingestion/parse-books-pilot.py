#!/usr/bin/env python3
"""Create lossless-enough staged DOCX source records and conservative parser units."""

from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.table import Table
from docx.text.paragraph import Paragraph


if len(sys.argv) != 5:
    raise SystemExit(
        "Usage: parse-books-pilot.py <inventory.json> <selection.json> <docx-dir> <output-dir>"
    )

inventory_path = Path(sys.argv[1])
selection_path = Path(sys.argv[2])
docx_dir = Path(sys.argv[3])
output_dir = Path(sys.argv[4])
source_dir = output_dir / "source-records"
parsed_dir = output_dir / "parsed"
source_dir.mkdir(parents=True, exist_ok=True)
parsed_dir.mkdir(parents=True, exist_ok=True)

inventory = json.loads(inventory_path.read_text())
selection = json.loads(selection_path.read_text())
download_manifest = json.loads((docx_dir / "sample-download-manifest.json").read_text())
inventory_by_position = {record["source_position"]: record for record in inventory["records"]}
download_by_position = {record["source_position"]: record for record in download_manifest["results"]}

chapter_pattern = re.compile(r"^(?:chapter|part|book)\s+(?:[0-9ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten)\b", re.I)
section_pattern = re.compile(
    r"^(?:introduction|conclusion|preface|foreword|afterword|epilogue|prologue|action steps?|"
    r"the attribute of\b|the supportive statement\b|.+\bas a daily practice)$",
    re.I,
)
list_pattern = re.compile(r"^(?:[•◦▪●*-]|\(?\d+[.)]|\(?[a-z][.)])\s+", re.I)
note_pattern = re.compile(r"^(?:note|editor(?:'s)? note)\s*[:—-]", re.I)
worksheet_pattern = re.compile(r"(?:_{8,}|\.{8,}|-{12,})")
locator_pattern = re.compile(r"\b(?P<label>page|p\.|location|loc\.)\s*[:#-]?\s*(?P<number>\d+)\b", re.I)
possible_personal_summary_pattern = re.compile(
    r"^(?:the|this)\s+(?:passage|chapter|section|book|author)\s+(?:is\s+)?(?:describes?|discusses?|explains?|suggests?|argues?|summari[sz]es?|focuses?|examines?|explores?|presents?|emphasizes?)\b",
    re.I,
)

alignment_names = {
    None: None,
    WD_ALIGN_PARAGRAPH.LEFT: "left",
    WD_ALIGN_PARAGRAPH.CENTER: "center",
    WD_ALIGN_PARAGRAPH.RIGHT: "right",
    WD_ALIGN_PARAGRAPH.JUSTIFY: "justify",
    WD_ALIGN_PARAGRAPH.DISTRIBUTE: "distribute",
}


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def points(value):
    return None if value is None else round(value.pt, 3)


def color_value(color):
    if color is None or color.rgb is None:
        return None
    return str(color.rgb)


def numbering(paragraph: Paragraph):
    properties = paragraph._p.pPr
    if properties is None or properties.numPr is None:
        return None
    num_pr = properties.numPr
    return {
        "num_id": int(num_pr.numId.val) if num_pr.numId is not None else None,
        "level": int(num_pr.ilvl.val) if num_pr.ilvl is not None else None,
    }


def serialize_run(run):
    return {
        "text": run.text,
        "style": run.style.name if run.style else None,
        "bold": run.bold,
        "italic": run.italic,
        "underline": bool(run.underline) if run.underline is not None else None,
        "strike": run.font.strike,
        "highlight_color": str(run.font.highlight_color) if run.font.highlight_color is not None else None,
        "font_name": run.font.name,
        "font_size_points": points(run.font.size),
        "font_color_rgb": color_value(run.font.color),
        "superscript": run.font.superscript,
        "subscript": run.font.subscript,
    }


def serialize_paragraph(paragraph: Paragraph, paragraph_index: int, body_index: int, container: str):
    paragraph_format = paragraph.paragraph_format
    return {
        "block_type": "paragraph",
        "body_index": body_index,
        "paragraph_index": paragraph_index,
        "container": container,
        "text": paragraph.text,
        "style": paragraph.style.name if paragraph.style else None,
        "alignment": alignment_names.get(paragraph.alignment, str(paragraph.alignment) if paragraph.alignment is not None else None),
        "numbering": numbering(paragraph),
        "formatting": {
            "left_indent_points": points(paragraph_format.left_indent),
            "right_indent_points": points(paragraph_format.right_indent),
            "first_line_indent_points": points(paragraph_format.first_line_indent),
            "space_before_points": points(paragraph_format.space_before),
            "space_after_points": points(paragraph_format.space_after),
            "line_spacing": str(paragraph_format.line_spacing) if paragraph_format.line_spacing is not None else None,
            "keep_together": paragraph_format.keep_together,
            "keep_with_next": paragraph_format.keep_with_next,
            "page_break_before": paragraph_format.page_break_before,
            "widow_control": paragraph_format.widow_control,
        },
        "runs": [serialize_run(run) for run in paragraph.runs],
    }


def serialize_table(table: Table, body_index: int, paragraph_counter: list[int]):
    rows = []
    for row_index, row in enumerate(table.rows):
        cells = []
        for cell_index, cell in enumerate(row.cells):
            paragraphs = []
            for paragraph in cell.paragraphs:
                paragraphs.append(
                    serialize_paragraph(
                        paragraph,
                        paragraph_counter[0],
                        body_index,
                        f"table:{body_index}/row:{row_index}/cell:{cell_index}",
                    )
                )
                paragraph_counter[0] += 1
            cells.append({"cell_index": cell_index, "paragraphs": paragraphs})
        rows.append({"row_index": row_index, "cells": cells})
    return {
        "block_type": "table",
        "body_index": body_index,
        "style": table.style.name if table.style else None,
        "rows": rows,
    }


def has_all_caps_heading_shape(text: str) -> bool:
    letters = [character for character in text if character.isalpha()]
    return bool(letters) and len(text) <= 100 and len(text.split()) <= 14 and all(character.isupper() for character in letters)


def title_similarity(text: str, title: str) -> bool:
    normalize = lambda value: re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
    normalized_text = normalize(text)
    normalized_title = normalize(title)
    return normalized_title in normalized_text or normalized_text in normalized_title


def classify(paragraph, source_title: str, is_first_nonempty: bool):
    text = paragraph["text"].strip()
    style = (paragraph["style"] or "").lower()
    word_count = len(text.split())
    runs_with_text = [run for run in paragraph["runs"] if run["text"]]
    all_italic = bool(runs_with_text) and all(run["italic"] is True for run in runs_with_text)

    if is_first_nonempty and (title_similarity(text, source_title) or re.search(r"\bbook (?:notes|highlights)\b", text, re.I)):
        return "document_title", 0.99, "first substantive paragraph identifies the document/book", False
    if locator_pattern.fullmatch(text):
        return "locator", 0.99, "explicit standalone page/location marker", False
    if chapter_pattern.search(text):
        return "chapter_label", 0.97, "explicit chapter/part/book label", False
    if style.startswith("heading"):
        return "section_label", 0.97, f"semantic DOCX style {paragraph['style']}", False
    if section_pattern.search(text) and word_count <= 18:
        return "section_label", 0.88, "recognized section-label phrase", False
    if has_all_caps_heading_shape(text):
        return "section_label", 0.78, "short all-caps paragraph with heading shape", True
    if worksheet_pattern.search(text) and len(re.sub(r"[_\.\-\s]", "", text)) < 100:
        return "worksheet_element", 0.91, "long worksheet blank/separator pattern", False
    if paragraph["numbering"] is not None or style.startswith("list") or list_pattern.search(text):
        kind = "exercise" if re.search(r"\b(?:exercise|practice|try|write|list|ask yourself)\b", text, re.I) else "list_item"
        return kind, 0.87, "DOCX numbering/list structure or explicit list marker", False
    if note_pattern.search(text):
        return "note", 0.62, "explicit note-shaped source label; authorship not inferred", True
    if possible_personal_summary_pattern.search(text) and word_count >= 18:
        return "possible_personal_summary", 0.72, "explicit passage/author metadiscourse suggests summary material; authorship remains unresolved", True
    if all_italic and word_count >= 20:
        return "summary", 0.56, "fully italic substantive block; origin and structural role remain ambiguous", True
    if word_count <= 3 and not re.search(r"[.!?;:]$", text):
        return "unknown", 0.35, "very short unstyled fragment with insufficient structural evidence", True
    return "highlight", 0.9, "default substantive book-derived content", False


def paragraph_iter(body_blocks):
    for block in body_blocks:
        if block["block_type"] == "paragraph":
            yield block
        else:
            for row in block["rows"]:
                for cell in row["cells"]:
                    yield from cell["paragraphs"]


manifest_records = []
for source_position in selection["source_positions"]:
    inventory_record = inventory_by_position[source_position]
    download = download_by_position[source_position]
    docx_path = docx_dir / download["local_file"]
    document = Document(docx_path)
    paragraph_counter = [0]
    body_blocks = []

    for body_index, block in enumerate(document.iter_inner_content()):
        if isinstance(block, Paragraph):
            body_blocks.append(
                serialize_paragraph(block, paragraph_counter[0], body_index, "document_body")
            )
            paragraph_counter[0] += 1
        elif isinstance(block, Table):
            body_blocks.append(serialize_table(block, body_index, paragraph_counter))

    source_record = {
        "schema_version": "book-highlight-source-record.v1",
        "record_id": f"bookshelf-{source_position:03d}",
        "bookshelf_source": inventory_record,
        "document": {
            "source_url": inventory_record["highlights_url"],
            "document_id": download["document_id"],
            "export_format": "docx",
            "export_sha256": sha256(docx_path),
            "export_bytes": docx_path.stat().st_size,
            "paragraph_count_including_empty_and_tables": paragraph_counter[0],
            "body_block_count": len(body_blocks),
            "section_count": len(document.sections),
            "body_blocks": body_blocks,
        },
        "provenance": {
            "extraction": "public Google Docs DOCX export",
            "mutated_source": False,
            "source_order_preserved": True,
            "formatting_preserved_as_structured_properties": True,
        },
    }

    source_path = source_dir / f"{source_position:03d}.source.v1.json"
    source_path.write_text(json.dumps(source_record, ensure_ascii=False, indent=2) + "\n")

    units = []
    current_sections = []
    pending_locator = None
    first_nonempty = True
    for paragraph in paragraph_iter(body_blocks):
        text = paragraph["text"].strip()
        if not text:
            continue
        kind, confidence, reason, requires_review = classify(
            paragraph, inventory_record["title_displayed"], first_nonempty
        )
        first_nonempty = False
        if kind == "chapter_label":
            current_sections = [text]
        elif kind == "section_label":
            if current_sections:
                current_sections = [current_sections[0], text]
            else:
                current_sections = [text]

        locator_match = locator_pattern.search(text)
        locator = None
        if locator_match:
            label = locator_match.group("label").lower()
            locator = {
                "raw": locator_match.group(0),
                "page": int(locator_match.group("number")) if label.startswith(("page", "p.")) else None,
                "location": int(locator_match.group("number")) if label.startswith(("location", "loc.")) else None,
                "source_paragraph": paragraph["paragraph_index"],
            }
        if kind == "locator":
            pending_locator = locator
        elif locator is None and pending_locator is not None and kind in {
            "highlight", "summary", "possible_personal_summary", "note", "list_item", "exercise", "unknown"
        }:
            locator = {
                **pending_locator,
                "association": "explicit standalone locator immediately preceding this substantive unit",
            }
            pending_locator = None

        unit = {
            "unit_id": f"bookshelf-{source_position:03d}-unit-{len(units) + 1:04d}",
            "ordinal": len(units) + 1,
            "text": text,
            "kind": kind,
            "classification_confidence": confidence,
            "classification_reason": reason,
            "review_status": "unreviewed",
            "requires_review": requires_review,
            "source_range": {
                "paragraph_start": paragraph["paragraph_index"],
                "paragraph_end": paragraph["paragraph_index"],
                "body_block_start": paragraph["body_index"],
                "body_block_end": paragraph["body_index"],
                "container": paragraph["container"],
            },
            "section_path": list(current_sections),
            "locator": locator,
            "formatting": {
                "paragraph_style": paragraph["style"],
                "alignment": paragraph["alignment"],
                "numbering": paragraph["numbering"],
                "runs": paragraph["runs"],
            },
            "provenance": {
                "content_origin": "unknown_possible_personal_summary" if kind == "possible_personal_summary" else "presumed_book_derived",
                "joe_authorship_inferred": False,
                "quotation_status_inferred": False,
            },
            "public_eligible": kind != "possible_personal_summary",
        }
        units.append(unit)

    counts = Counter(unit["kind"] for unit in units)
    parsed_record = {
        "schema_version": "book-highlight-parser-output.v1",
        "record_id": source_record["record_id"],
        "source_record": f"../source-records/{source_path.name}",
        "parser": {
            "name": "synergetic-books-conservative-docx-parser",
            "version": "0.2.0",
            "paragraph_merging": False,
            "default_substantive_kind": "highlight",
        },
        "summary": {
            "candidate_units": len(units),
            "kind_counts": dict(sorted(counts.items())),
            "requires_review": sum(unit["requires_review"] for unit in units),
            "explicit_locator_units": sum(unit["kind"] == "locator" for unit in units),
            "units_with_explicit_locators": sum(unit["locator"] is not None and unit["kind"] != "locator" for unit in units),
        },
        "units": units,
    }
    parsed_path = parsed_dir / f"{source_position:03d}.parsed.v1.json"
    parsed_path.write_text(json.dumps(parsed_record, ensure_ascii=False, indent=2) + "\n")
    manifest_records.append(
        {
            "source_position": source_position,
            "title_displayed": inventory_record["title_displayed"],
            "source_record": str(source_path.relative_to(output_dir)),
            "parsed_record": str(parsed_path.relative_to(output_dir)),
            **parsed_record["summary"],
        }
    )

manifest = {
    "schema_version": selection.get("manifest_schema_version", "bookshelf-parser-pilot-manifest.v1"),
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "selection": str(selection_path),
    "record_count": len(manifest_records),
    "parser_version": "0.2.0",
    "records": manifest_records,
}
(output_dir / selection.get("manifest_file", "parser-pilot-manifest.v1.json")).write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
)
print(json.dumps({"record_count": len(manifest_records), "records": manifest_records}, indent=2))
