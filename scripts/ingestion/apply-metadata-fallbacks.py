#!/usr/bin/env python3
"""Apply reviewed metadata fallbacks, derive source-only candidates, and cache covers."""

from __future__ import annotations

import hashlib
import io
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


if len(sys.argv) != 2:
    raise SystemExit("Usage: apply-metadata-fallbacks.py <pilot-dir>")

pilot_dir = Path(sys.argv[1])
metadata_dir = pilot_dir / "metadata"
cover_dir = pilot_dir / "covers"
fallbacks = json.loads((pilot_dir / "metadata-fallbacks.v1.json").read_text())
fallback_by_position = {item["source_position"]: item for item in fallbacks["records"]}
user_agent = "SynergeticHumanBooksPilot/0.1 (local non-production metadata review)"


def source_only_title(record: dict) -> tuple[str, str | None]:
    """Keep the displayed title unless the correction is truly mechanical."""
    displayed = record["source"]["title_displayed"]
    corrected = {"Pouring Conrete": "Pouring Concrete"}.get(displayed, displayed)
    observed = record["source"].get("document_title_observed") or ""
    subtitle = None
    if observed.lower().startswith(corrected.lower() + ":"):
        subtitle = observed.split(":", 1)[1].strip() or None
    return corrected, subtitle


def cache_cover(source: dict, position: int, title: str) -> dict:
    request = urllib.request.Request(source["source_url"], headers={"User-Agent": user_agent, "Accept": "image/*"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            content_type = response.headers.get("content-type")
        image = Image.open(io.BytesIO(body))
        image.verify()
        verified = Image.open(io.BytesIO(body))
        width, height = verified.size
        image_format = (verified.format or "JPEG").lower()
        extension = "jpg" if image_format in {"jpeg", "jpg"} else image_format
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:55]
        path = cover_dir / f"{position:03d}-{slug}.{extension}"
        path.write_bytes(body)
        return {
            **source,
            "status": "cached",
            "local_path": f"covers/{path.name}",
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "content_type": content_type,
            "image_format": verified.format,
            "width": width,
            "height": height,
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "usage_note": "Pilot cache from provider-supplied cover endpoint; verify provider terms before production use.",
        }
    except Exception as error:
        return {**source, "status": "download_failed", "error": f"{type(error).__name__}: {error}"}


manifest_records = []
for path in sorted(metadata_dir.glob("*.metadata.v1.json")):
    record = json.loads(path.read_text())
    position = record["source_position"]
    fallback = fallback_by_position.get(position)

    if fallback:
        prior = record.get("prior_automated_match")
        if not prior or prior.get("status") in {"high_confidence_fallback", "high_confidence_partial", "source_only"}:
            prior = record["match"] if record["match"].get("status") not in {"high_confidence_fallback", "high_confidence_partial", "source_only"} else None
        if prior:
            record["prior_automated_match"] = prior
        else:
            record.pop("prior_automated_match", None)
        metadata = fallback["metadata"]
        record["match"] = {
            "status": fallback["status"],
            "accepted_for_cover_pilot": bool(fallback.get("cover")),
            "top_score": fallback["score"],
            "runner_up_score": None,
            "score_margin": None,
            "selected_candidate": {**metadata, "provenance_urls": fallback["provenance_urls"]},
            "candidate_count": 1,
            "top_candidates": [{**metadata, "score": fallback["score"], "provenance_urls": fallback["provenance_urls"]}],
            "scoring": "Curated pilot fallback; see match_basis and provenance URLs.",
            "match_basis": fallback["match_basis"],
        }
        record["canonical_metadata_suggestion"] = {**metadata, "review_status": "suggested"}
        record["provider_provenance"]["curated_fallback_urls"] = fallback["provenance_urls"]
        if fallback.get("cover"):
            record["cover_candidate"] = cache_cover(fallback["cover"], position, metadata["title"])
        else:
            record["cover_candidate"] = None
        record["warnings"] = list(dict.fromkeys(record.get("warnings", []) + fallback.get("warnings", [])))
    elif record["match"]["status"] == "unmatched":
        source_title, source_subtitle = source_only_title(record)
        record["prior_automated_match"] = record["match"]
        record["match"] = {
            **record["match"],
            "status": "source_only",
            "selected_candidate": None,
            "scoring": "No usable public-catalog candidate; canonical suggestion is derived only from preserved source fields.",
        }
        record["canonical_metadata_suggestion"] = {
            "title": source_title,
            "subtitle": source_subtitle,
            "authors": [record["source"]["author_displayed"]] if record["source"].get("author_displayed") else [],
            "isbn_10": record["source"]["identifiers_extracted"].get("isbn_10_candidate_from_asin"),
            "isbn_13": None,
            "publisher": None,
            "published_date": None,
            "provider": "source_record",
            "provider_id": record["record_id"],
            "review_status": "requires_enrichment_review",
        }
        record["warnings"] = list(dict.fromkeys(record.get("warnings", []) + ["No reliable public-catalog match was available during the pilot."]))
    elif record["match"]["status"] == "source_only":
        source_title, source_subtitle = source_only_title(record)
        record["canonical_metadata_suggestion"]["title"] = source_title
        record["canonical_metadata_suggestion"]["subtitle"] = source_subtitle
        prior = record.get("prior_automated_match")
        if prior and prior.get("status") == "source_only":
            record.pop("prior_automated_match", None)

    path.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    cover = record.get("cover_candidate")
    manifest_records.append({
        "source_position": position,
        "source_title": record["source"]["title_displayed"],
        "canonical_title_suggestion": record["canonical_metadata_suggestion"]["title"],
        "match_status": record["match"]["status"],
        "top_score": record["match"].get("top_score"),
        "candidate_count": record["match"].get("candidate_count", 0),
        "cover_status": cover["status"] if cover else "none",
        "metadata_record": f"metadata/{path.name}",
    })

manifest = {
    "schema_version": "bookshelf-metadata-cover-pilot-manifest.v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "record_count": len(manifest_records),
    "records": manifest_records,
    "notes": [
        "Automated provider responses remain cached exactly as received.",
        "Curated fallbacks preserve the prior automated match and cite their provenance URLs.",
        "A source-only suggestion is not a catalog match and requires enrichment review.",
        "No Amazon images were scraped.",
    ],
}
(pilot_dir / "metadata-cover-pilot-manifest.v1.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"records": len(manifest_records), "covers_cached": sum(r["cover_status"] == "cached" for r in manifest_records), "cover_failures": [r["source_position"] for r in manifest_records if r["cover_status"] == "download_failed"]}, indent=2))
