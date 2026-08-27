#!/usr/bin/env python3
"""Render the local Books parser/metadata/cover pilot as reviewable Markdown."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path


if len(sys.argv) != 3:
    raise SystemExit("Usage: render-books-pilot-report.py <pilot-dir> <output.md>")

pilot_dir = Path(sys.argv[1])
output_path = Path(sys.argv[2])
parser_manifest = json.loads((pilot_dir / "parser-pilot-manifest.v1.json").read_text())


def clean(text: str | None) -> str:
    return (text or "—").replace("|", "\\|").replace("\n", " ")


def clipped(text: str, limit: int = 240) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


books = []
for item in parser_manifest["records"]:
    position = item["source_position"]
    metadata = json.loads((pilot_dir / "metadata" / f"{position:03d}.metadata.v1.json").read_text())
    parsed = json.loads((pilot_dir / "parsed" / f"{position:03d}.parsed.v1.json").read_text())
    suggestions = json.loads((pilot_dir / "suggestions" / f"{position:03d}.suggestions.v1.json").read_text())
    books.append((item, metadata, parsed, suggestions))

status_counts = Counter(metadata["match"]["status"] for _, metadata, _, _ in books)
cover_count = sum(bool(metadata.get("cover_candidate") and metadata["cover_candidate"]["status"] == "cached") for _, metadata, _, _ in books)
total_units = sum(parsed["summary"]["candidate_units"] for _, _, parsed, _ in books)
total_highlights = sum(parsed["summary"]["kind_counts"].get("highlight", 0) for _, _, parsed, _ in books)
total_review = sum(parsed["summary"]["requires_review"] for _, _, parsed, _ in books)
total_locators = sum(parsed["summary"]["explicit_locator_units"] for _, _, parsed, _ in books)

lines = [
    "# Books Parser, Metadata, and Cover Pilot Review",
    "",
    "> Local staging only. Every metadata, topic, relationship, classification, and standout remains unapproved until editorial review. No Supabase writes, deployment, Amazon image scraping, or legacy-site mutation occurred.",
    "",
    "## Outcome",
    "",
    f"The 15-book pilot produced **{total_units:,} traceable content units**, including **{total_highlights:,} highlight/excerpt candidates**. **{total_review} units** are explicitly queued for classification review, and **{total_locators} source paragraphs** were recognized as explicit locators without inventing any others. The pilot cached **{cover_count} real provider covers**.",
    "",
    "Metadata resolution currently breaks down as follows:",
    "",
    f"- **{status_counts['high_confidence']}** automated high-confidence public-catalog matches.",
    f"- **{status_counts['high_confidence_fallback']}** high-confidence catalog fallbacks after reviewing edition-level provenance.",
    f"- **{status_counts['high_confidence_partial']}** high-confidence identities with incomplete catalog fields.",
    f"- **{status_counts['source_only']}** source-only suggestions requiring later catalog review.",
    "",
    "The core parser scales mechanically: source order, formatting runs, structural labels, and deterministic paragraph ranges survive export. Metadata enrichment does **not** yet scale unattended because Google Books rejected most unauthenticated calls with HTTP 429 and Open Library search was intermittent. A production-scale run should use a configured Google Books API key, caching, throttling, ISBN-first queries, and an edition-review queue.",
    "",
    "## Review priorities",
    "",
    "1. Inspect the `summary` treatment in *Mysticism* and the short/all-caps labels in *The Big Leap*, *Zen Mind, Beginner's Mind*, *Disciples of the Mysterium*, and *Conscious Accomplishment*.",
    "2. Confirm whether combined source titles such as `Face to No Face / On Having No Head` should become one book, two books, or an alias relationship. The pilot does not decide this.",
    "3. Review the source URL for *All for Love*: it is malformed (`hhttps`) and targets a card deck, while the highlights document is for the book.",
    "4. Approve or reject the seven recognizable-edition covers. Exact-edition identity is deliberately not asserted.",
    "5. Judge whether the deterministic topic and standout candidates are useful enough to seed a later editorial queue. None are accepted truth.",
    "",
    "## Pilot summary",
    "",
    "| # | Original title | Canonical suggestion | Match | Cover | Highlights | Review units |",
    "|---:|---|---|---|---:|---:|---:|",
]

for item, metadata, parsed, _ in books:
    canonical = metadata["canonical_metadata_suggestion"]
    cover = metadata.get("cover_candidate")
    lines.append(
        f"| {item['source_position']} | {clean(metadata['source']['title_displayed'])} | {clean(canonical['title'])} | {metadata['match']['status']} | {'yes' if cover and cover['status'] == 'cached' else '—'} | {parsed['summary']['kind_counts'].get('highlight', 0)} | {parsed['summary']['requires_review']} |"
    )

lines.extend([
    "",
    "## Book-by-book review",
    "",
])

for item, metadata, parsed, suggestions in books:
    position = item["source_position"]
    source = metadata["source"]
    canonical = metadata["canonical_metadata_suggestion"]
    match = metadata["match"]
    cover = metadata.get("cover_candidate")
    uncertain = [unit for unit in parsed["units"] if unit.get("requires_review")]
    structural = {key: value for key, value in parsed["summary"]["kind_counts"].items() if key != "highlight"}
    lines.extend([
        f"<details id=\"book-{position:03d}\">",
        f"<summary><strong>{position}. {clean(source['title_displayed'])}</strong> → {clean(canonical['title'])}</summary>",
        "",
    ])
    if cover and cover["status"] == "cached":
        rel_cover = f"../data/ingestion/bookshelf/pilot-v1/{cover['local_path']}"
        lines.extend([f"![{clean(canonical['title'])} cover]({rel_cover})", ""])
    lines.extend([
        f"- **Source:** [{clean(source['title_displayed'])} highlights]({source['highlights_url']}) · [preserved external link]({source['external_book_url']})",
        f"- **Source author:** {clean(source.get('author_displayed'))}",
        f"- **Metadata match:** `{match['status']}` · score {match.get('top_score') if match.get('top_score') is not None else 'n/a'} · provider `{canonical.get('provider') or 'none'}` `{canonical.get('provider_id') or ''}`",
        f"- **Candidate metadata:** {clean(canonical['title'])}{(': ' + clean(canonical.get('subtitle'))) if canonical.get('subtitle') else ''} — {', '.join(canonical.get('authors') or []) or 'author unresolved'}; ISBN-10 {canonical.get('isbn_10') or '—'}; ISBN-13 {canonical.get('isbn_13') or '—'}; {canonical.get('publisher') or 'publisher unresolved'}; {canonical.get('published_date') or 'date unresolved'}.",
        f"- **Parser:** {parsed['summary']['kind_counts'].get('highlight', 0)} highlights/excerpts; {parsed['summary']['candidate_units']} total units; {parsed['summary']['requires_review']} review units; structure `{json.dumps(structural, ensure_ascii=False, sort_keys=True)}`.",
    ])
    if match.get("match_basis"):
        lines.append(f"- **Match basis:** {match['match_basis']}")
    if cover:
        lines.append(f"- **Cover:** `{cover['status']}` from `{cover['provider']}`; `{cover.get('local_path') or 'not cached'}`.")
    else:
        lines.append("- **Cover:** none accepted or cached for this pilot record.")
    if uncertain:
        lines.append("- **Uncertain classifications:**")
        for unit in uncertain[:5]:
            source_range = unit["source_range"]
            lines.append(f"  - `{unit['unit_id']}` · `{unit['kind']}` · confidence {unit['classification_confidence']} · paragraph {source_range['paragraph_start']}: “{clipped(unit['text'], 180)}”")
        if len(uncertain) > 5:
            lines.append(f"  - …and {len(uncertain) - 5} more in the parsed JSON.")
    else:
        lines.append("- **Uncertain classifications:** none automatically flagged.")

    topics = suggestions["suggested_topics"]
    lines.append("- **Suggested topics (unapproved):** " + ("; ".join(f"{topic['topic']} ({topic['confidence']:.2f})" for topic in topics) if topics else "none"))
    related = suggestions["suggested_related_books"]
    lines.append("- **Suggested related pilot books (unapproved):** " + ("; ".join(f"{rel['title']} ({rel['confidence']:.2f}; {', '.join(rel['shared_topics'])})" for rel in related) if related else "none above the pilot threshold"))
    lines.append("- **Suggested standouts (unapproved):**")
    for standout in suggestions["suggested_standout_highlights"]:
        lines.append(f"  {standout['rank']}. `{standout['unit_id']}` · paragraph {standout['source_range']['paragraph_start']} · “{clipped(standout['text'], 300)}”")
    if not suggestions["suggested_standout_highlights"]:
        lines.append("  - None suggested.")
    warnings = metadata.get("warnings") or []
    lines.append("- **Warnings:** " + ("; ".join(warnings) if warnings else "none"))
    lines.extend(["", "</details>", ""])

lines.extend([
    "## What the pilot says about scaling",
    "",
    "The document parser is a viable starting point for the full corpus, provided scale-out retains a review queue for short headings, all-caps labels, italic summary-like material, and mixed workbook structures. It should not merge paragraphs automatically. The exceptionally structured *Artist's Way* document demonstrates why `list_item`, `exercise`, and `worksheet_element` must remain distinct from highlights.",
    "",
    "Metadata needs a two-pass workflow: identifier-first automated lookup, then title/author scoring, then a human decision only for ambiguous or incomplete records. Provider work-level results must never be allowed to mix ISBNs or publisher/date data across editions; the corrected `$100M Offers` and *Zen Mind, Beginner's Mind* records show that risk directly.",
    "",
    "Cover retrieval should continue in this order: accepted Google Books image links, accepted Open Library cover/edition endpoints, then an explicitly licensed publisher/author source if needed. Cache the original URL, retrieval time, dimensions, content type, and hash. Do not scrape Amazon images.",
    "",
    "## Local artifacts",
    "",
    "- `source-records/`: exact exported document structure and formatting provenance.",
    "- `parsed/`: deterministic candidate units and paragraph/body-block ranges.",
    "- `provider-cache/`: raw API responses and errors.",
    "- `metadata/`: scored matches, canonical suggestions, warnings, and preserved prior automated matches.",
    "- `covers/`: seven pilot-only cached cover images.",
    "- `suggestions/`: unapproved topics, relationships, and standouts.",
    "- `metadata-fallbacks.v1.json`: reviewable fallback facts and URLs.",
    "",
    "## Recommended next decision",
    "",
    "Review the 15 records above before scaling. If the parser classifications and standout usefulness are acceptable, scale document parsing first. Scale metadata separately after adding authenticated Google Books access and a small edition-review interface. Keep the inaccessible six Docs unresolved until their sharing permissions change. Do not create the production Supabase Brain schema until the full staged corpus has passed these checks.",
    "",
])

output_path.parent.mkdir(parents=True, exist_ok=True)
output_path.write_text("\n".join(lines), encoding="utf-8")
print(f"wrote {output_path} ({len(lines)} lines)")
