#!/usr/bin/env python3
"""Generate deterministic, explicitly unapproved editorial suggestions for the pilot."""

from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


if len(sys.argv) != 2:
    raise SystemExit("Usage: suggest-books-pilot.py <pilot-dir>")

pilot_dir = Path(sys.argv[1])
suggestions_dir = pilot_dir / "suggestions"
suggestions_dir.mkdir(parents=True, exist_ok=True)

TOPICS = {
    "business & value creation": ["business", "offer", "market", "customer", "price", "value", "sales", "entrepreneur"],
    "creativity & artistic practice": ["creative", "creativity", "artist", "art", "writing", "imagination", "morning pages"],
    "consciousness & nonduality": ["consciousness", "awareness", "nondual", "headless", "who am i", "ego", "identity"],
    "spirituality & mysticism": ["spiritual", "mystic", "mysticism", "divine", "soul", "god", "sacred", "awakening"],
    "love & relationships": ["love", "loving", "relationship", "heart", "compassion", "connection", "intimacy"],
    "health & longevity": ["health", "longevity", "aging", "nutrition", "sleep", "disease", "lifespan"],
    "mind-body healing": ["pain", "trauma", "symptom", "nervous system", "healing", "psychophysiologic", "body", "emotion"],
    "meditation & contemplative practice": ["meditation", "zazen", "mindfulness", "breath", "zen", "contemplation"],
    "personal growth & behavior": ["growth", "potential", "habit", "fear", "change", "success", "achievement", "belief"],
    "money & sufficiency": ["money", "wealth", "scarcity", "sufficiency", "generosity", "prosperity", "resource"],
    "meaning & purpose": ["meaning", "purpose", "calling", "fulfillment", "mission", "service"],
    "philosophy & self-inquiry": ["philosophy", "inquiry", "truth", "reality", "knowledge", "perception", "existence"],
    "embodiment & energy": ["energy", "flow", "embodied", "movement", "touch", "somatic", "chakra"],
    "exercises & applied practice": ["exercise", "worksheet", "write", "task", "week"],
    "society, culture & systems": ["society", "culture", "system", "group", "civilization", "community"],
}

MANUAL_HINTS = {
    1: ["business & value creation", "personal growth & behavior"],
    5: ["love & relationships", "spirituality & mysticism"],
    20: ["personal growth & behavior", "spirituality & mysticism"],
    25: ["philosophy & self-inquiry", "consciousness & nonduality"],
    31: ["consciousness & nonduality", "philosophy & self-inquiry"],
    50: ["health & longevity"],
    62: ["embodiment & energy", "mind-body healing"],
    67: ["love & relationships", "spirituality & mysticism"],
    75: ["spirituality & mysticism", "meditation & contemplative practice"],
    89: ["spirituality & mysticism", "meaning & purpose"],
    90: ["mind-body healing", "health & longevity"],
    107: ["creativity & artistic practice", "exercises & applied practice"],
    110: ["personal growth & behavior", "exercises & applied practice"],
    140: ["money & sufficiency", "meaning & purpose"],
    165: ["meditation & contemplative practice", "spirituality & mysticism"],
}


def normalized(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()


def topic_suggestions(position: int, title: str, units: list[dict]) -> list[dict]:
    corpus = normalized(title + " " + " ".join(unit["text"] for unit in units))
    suggestions = []
    for topic, terms in TOPICS.items():
        hits = {term: len(re.findall(rf"(?<!\w){re.escape(term)}(?!\w)", corpus)) for term in terms}
        hits = {term: count for term, count in hits.items() if count}
        manual = topic in MANUAL_HINTS.get(position, [])
        weighted = 1.15 * len(hits) + math.log1p(sum(hits.values())) + (2.8 if manual else 0)
        if weighted < 4.2:
            continue
        confidence = min(0.93, 0.38 + 0.065 * weighted)
        suggestions.append({
            "topic": topic,
            "confidence": round(confidence, 2),
            "review_status": "suggested_unapproved",
            "reasoning": "title/content keyword evidence" + (" plus pilot selection hint" if manual else ""),
            "evidence_terms": sorted(hits, key=lambda term: (-hits[term], term))[:6],
        })
    return sorted(suggestions, key=lambda item: (-item["confidence"], item["topic"]))[:4]


def standout_score(unit: dict) -> float:
    text = unit["text"].strip()
    words = re.findall(r"\b[\w’'-]+\b", text)
    count = len(words)
    if count < 10 or count > 115 or len(text) < 60:
        return -1
    if not text[0].isupper() or text.startswith("#") or "http://" in text or "https://" in text:
        return -1
    if re.match(r"^(?:in summary|summary|product delivery cheat codes)\s*:", text, flags=re.I):
        return -1
    length_score = max(0, 1 - abs(count - 42) / 75)
    complete = 0.14 if text[-1:] in ".!?" else 0
    memorable_terms = ["life", "love", "truth", "world", "self", "mind", "freedom", "meaning", "creative", "change", "practice", "money", "consciousness"]
    semantic = min(0.18, sum(term in text.lower() for term in memorable_terms) * 0.035)
    ambiguity_penalty = 0.15 if unit["kind"] in {"summary", "unknown"} else 0
    review_penalty = 0.12 if unit.get("requires_review") else 0
    return length_score + complete + semantic - ambiguity_penalty - review_penalty


def standout_suggestions(units: list[dict]) -> list[dict]:
    eligible = [unit for unit in units if unit["kind"] in {"highlight", "summary"}]
    ranked = sorted(eligible, key=lambda unit: (-standout_score(unit), unit["ordinal"]))
    selected = []
    used_sections = set()
    fingerprints = set()
    for unit in ranked:
        score = standout_score(unit)
        if score < 0:
            continue
        fingerprint = " ".join(normalized(unit["text"]).split()[:10])
        if fingerprint in fingerprints:
            continue
        section = tuple(unit.get("section_path") or [])
        if section and section in used_sections and len(selected) < 2:
            continue
        selected.append({
            "rank": len(selected) + 1,
            "unit_id": unit["unit_id"],
            "text": unit["text"],
            "source_range": unit["source_range"],
            "parsed_kind": unit["kind"],
            "confidence": round(min(0.92, 0.55 + score * 0.24), 2),
            "review_status": "suggested_unapproved",
            "reasoning": "Deterministic candidate: self-contained passage, readable length, and lexical salience; no quality or quotation-status claim.",
        })
        fingerprints.add(fingerprint)
        if section:
            used_sections.add(section)
        if len(selected) == 3:
            break
    return selected


books = {}
for path in sorted((pilot_dir / "parsed").glob("*.parsed.v1.json")):
    parsed = json.loads(path.read_text())
    position = int(path.name[:3])
    metadata = json.loads((pilot_dir / "metadata" / f"{position:03d}.metadata.v1.json").read_text())
    title = metadata["canonical_metadata_suggestion"]["title"] or metadata["source"]["title_displayed"]
    topics = topic_suggestions(position, title, parsed["units"])
    books[position] = {
        "position": position,
        "title": title,
        "parsed": parsed,
        "topics": topics,
        "standouts": standout_suggestions(parsed["units"]),
    }

for position, book in books.items():
    own = {item["topic"]: item["confidence"] for item in book["topics"]}
    related = []
    for other_position, other in books.items():
        if other_position == position:
            continue
        theirs = {item["topic"]: item["confidence"] for item in other["topics"]}
        overlap = sorted(set(own) & set(theirs))
        if not overlap:
            continue
        score = sum(min(own[topic], theirs[topic]) for topic in overlap) / math.sqrt(max(len(own), 1) * max(len(theirs), 1))
        if score < 0.35:
            continue
        related.append({
            "source_position": other_position,
            "title": other["title"],
            "confidence": round(min(score, 0.95), 2),
            "review_status": "suggested_unapproved",
            "reasoning": f"Shared suggested topic{'s' if len(overlap) != 1 else ''}: {', '.join(overlap)}.",
            "shared_topics": overlap,
        })
    related = sorted(related, key=lambda item: (-item["confidence"], item["source_position"]))[:5]
    output = {
        "schema_version": "book-editorial-suggestions.v1",
        "record_id": f"bookshelf-{position:03d}",
        "source_position": position,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "approval_state": "all suggestions are unapproved",
        "method": {
            "topics": "deterministic keyword evidence plus explicit pilot title hints",
            "relationships": "overlap among unapproved suggested topics within the 15-book pilot only",
            "standouts": "deterministic passage-length, completeness, salience, and section-diversity heuristic",
        },
        "suggested_topics": book["topics"],
        "suggested_related_books": related,
        "suggested_standout_highlights": book["standouts"],
    }
    (suggestions_dir / f"{position:03d}.suggestions.v1.json").write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")

manifest = {
    "schema_version": "bookshelf-editorial-suggestions-manifest.v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "record_count": len(books),
    "approval_state": "all suggestions are unapproved",
    "records": [
        {
            "source_position": position,
            "title": book["title"],
            "topic_count": len(book["topics"]),
            "related_book_count": len(json.loads((suggestions_dir / f"{position:03d}.suggestions.v1.json").read_text())["suggested_related_books"]),
            "standout_count": len(book["standouts"]),
            "suggestions_record": f"suggestions/{position:03d}.suggestions.v1.json",
        }
        for position, book in sorted(books.items())
    ],
}
(pilot_dir / "editorial-suggestions-manifest.v1.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({
    "records": len(books),
    "topics": sum(item["topic_count"] for item in manifest["records"]),
    "relationships": sum(item["related_book_count"] for item in manifest["records"]),
    "standouts": sum(item["standout_count"] for item in manifest["records"]),
}, indent=2))
