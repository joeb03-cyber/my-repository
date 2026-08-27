#!/usr/bin/env python3
"""Build deterministic, provenance-first travel records from the /notes/what snapshot."""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data/brain/travel/source/what.2026-08-27.md"
OUTPUT = ROOT / "data/brain/travel/travel-source-inventory.v1.json"
NAMESPACE = uuid.UUID("7f790137-c94e-42db-baa0-3c6bd179df41")

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7,
    "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def stable_id(kind: str, key: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{key}"))


def parse_month_range(raw: str, year: int) -> dict:
    parts = re.split(r"[/\-]", raw.strip().lower())
    if len(parts) not in (1, 2) or any(part not in MONTHS for part in parts):
        raise ValueError(f"Unrecognized source month expression: {raw!r}")
    start_month = MONTHS[parts[0]]
    end_month = MONTHS[parts[-1]]
    end_year = year + 1 if len(parts) == 2 and end_month < start_month else year
    return {
        "source_text": raw,
        "start": {"year": year, "month": start_month},
        "end": {"year": end_year, "month": end_month},
        "precision": "month" if len(parts) == 1 else "month_range",
    }


def candidate_places(raw_value: str) -> tuple[str, list[str]]:
    value = raw_value.strip()
    if value.lower().startswith("left "):
        return "departure", [value[5:].strip()]
    if value.lower().startswith("italy-"):
        return "grouped_visit", [part.strip() for part in value.split("-", 1)[1].split(",")]
    if " + " in value:
        return "grouped_visit", [part.strip() for part in value.split(" + ")]
    return "visit", [value]


def main() -> None:
    raw = SOURCE.read_text(encoding="utf-8")
    frontmatter, body = raw.split("---", 2)[1:]
    metadata = {}
    for line in frontmatter.strip().splitlines():
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"')

    records = []
    current_year = None
    source_position = 0
    for line_number, line in enumerate(body.splitlines(), start=len(frontmatter.splitlines()) + 4):
        year_match = re.fullmatch(r"\*\*(20\d{2})\*\*", line.strip())
        if year_match:
            current_year = int(year_match.group(1))
            continue
        bullet = re.fullmatch(r"\* ([^:]+): (.*)", line)
        if not bullet:
            continue
        if current_year is None:
            raise ValueError("Travel bullet appeared before a year heading")
        source_position += 1
        source_month, raw_value = bullet.groups()
        record_kind, places = candidate_places(raw_value)
        record_key = f"{current_year}:{source_position}:{source_month}:{raw_value}"
        records.append({
            "id": stable_id("source-record", record_key),
            "source_position": source_position,
            "source_line": line_number,
            "source_year_heading": current_year,
            "source_month_text": source_month,
            "source_value": raw_value,
            "source_raw_line": line,
            "record_kind": record_kind,
            "temporal_range": parse_month_range(source_month, current_year),
            "candidate_places": [
                {"id": stable_id("place-candidate", place.lower()), "source_name": place, "group_position": index + 1}
                for index, place in enumerate(places)
            ],
            "review": {
                "state": "needs_review" if record_kind != "visit" else "unreviewed",
                "flags": (["grouped_source_record"] if record_kind == "grouped_visit" else [])
                + (["movement_not_stay"] if record_kind == "departure" else []),
            },
        })

    intro = {
        "traveling_since": {"source_text": "september 2023", "year": 2023, "month": 9, "precision": "month"},
        "journey_note": "been quite a journey. slept in well over 100 different beds now since I started",
        "favorite_countries": ["argentina", "japan", "vietnam"],
        "favorite_places": ["buenos aires", "tokyo", "hoi an/da nang"],
    }
    payload = {
        "schema_version": "synergetic-travel-source.v1",
        "source": {
            **metadata,
            "snapshot_path": str(SOURCE.relative_to(ROOT)),
            "content_sha256": hashlib.sha256(raw.encode()).hexdigest(),
            "source_order": "reverse_chronological",
        },
        "intro": intro,
        "record_count": len(records),
        "candidate_place_reference_count": sum(len(record["candidate_places"]) for record in records),
        "records": records,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "records": len(records), "place_references": payload["candidate_place_reference_count"]}))


if __name__ == "__main__":
    main()
