#!/usr/bin/env python3
"""Strict, cached Google Books/Open Library recovery for placeholder covers."""

from __future__ import annotations

import hashlib
import io
import json
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image


if len(sys.argv) not in {5, 6}:
    raise SystemExit("Usage: recover-book-covers.py <metadata-dir> <public-cover-dir> <cache-dir> <report.json> [--apply]")

metadata_dir, cover_dir, cache_dir, report_path = map(Path, sys.argv[1:5])
apply_changes = len(sys.argv) == 6 and sys.argv[5] == "--apply"
if len(sys.argv) == 6 and not apply_changes:
    raise SystemExit("Only optional flag is --apply")
cache_dir.mkdir(parents=True, exist_ok=True)
(cache_dir / "responses").mkdir(exist_ok=True)
(cache_dir / "images").mkdir(exist_ok=True)
agent = "SynergeticHumanBooksImporter/1.1 (staging cover recovery; cached and rate limited)"


def normalize(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def title_score(source_title: str, candidate_title: str | None) -> float:
    variants = [source_title, *re.split(r"\s*/\s*", source_title)]
    scores = []
    for variant in variants:
        left, right = normalize(variant), normalize(candidate_title)
        if not left or not right:
            continue
        sequence = SequenceMatcher(None, left, right).ratio()
        left_tokens = set(left.split()) - {"the", "a", "an"}
        right_tokens = set(right.split()) - {"the", "a", "an"}
        jaccard = len(left_tokens & right_tokens) / len(left_tokens | right_tokens) if left_tokens | right_tokens else 0
        scores.append(max(sequence, jaccard))
    return max(scores, default=0)


def author_score(source_author: str | None, candidate_authors: list[str]) -> float:
    if not source_author:
        return 0
    source_people = [part.strip() for part in re.split(r"\s+(?:&|and)\s+|,", source_author, flags=re.I) if part.strip()]
    scores = []
    for source_person in source_people:
        for candidate in candidate_authors:
            left, right = normalize(source_person), normalize(candidate)
            if left and right:
                scores.append(max(SequenceMatcher(None, left, right).ratio(), 1.0 if left.split()[-1] == right.split()[-1] else 0))
    return max(scores, default=0)


def fetch_json(url: str, cache_path: Path) -> tuple[dict | None, str | None]:
    if cache_path.exists():
        cached = json.loads(cache_path.read_text())
        return cached.get("response"), cached.get("error")
    request = urllib.request.Request(url, headers={"User-Agent": agent, "Accept": "application/json"})
    response, error = None, None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as handle:
                response = json.loads(handle.read().decode("utf-8"))
            break
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            time.sleep(0.8 * (attempt + 1))
    cache_path.write_text(json.dumps({"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(), "response": response, "error": error}, indent=2, ensure_ascii=False) + "\n")
    time.sleep(0.25)
    return response, error


def google_candidates(data: dict | None) -> list[dict]:
    results = []
    for item in (data or {}).get("items", []):
        info = item.get("volumeInfo") or {}
        identifiers = {entry.get("type"): entry.get("identifier") for entry in info.get("industryIdentifiers", [])}
        images = info.get("imageLinks") or {}
        results.append({
            "provider": "google_books", "provider_id": item.get("id"), "title": info.get("title"), "subtitle": info.get("subtitle"),
            "authors": info.get("authors") or [], "isbn_10": identifiers.get("ISBN_10"), "isbn_13": identifiers.get("ISBN_13"),
            "publisher": info.get("publisher"), "published_date": info.get("publishedDate"), "language": info.get("language"),
            "info_url": info.get("infoLink"), "cover_url": next((images.get(key) for key in ("extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail") if images.get(key)), None),
        })
    return results


def open_library_candidates(metadata: dict) -> list[dict]:
    position = metadata["source_position"]
    cache = metadata_dir.parent / "provider-cache" / f"{position:03d}-search.json"
    if not cache.exists():
        return []
    response = json.loads(cache.read_text()).get("response") or {}
    candidates = []
    for item in response.get("docs") or []:
        isbns = item.get("isbn") or []
        candidates.append({
            "provider": "open_library", "provider_id": (item.get("key") or "").split("/")[-1] or None,
            "title": item.get("title"), "subtitle": item.get("subtitle"), "authors": item.get("author_name") or [],
            "isbn_10": next((value for value in isbns if len(value) == 10), None), "isbn_13": next((value for value in isbns if len(value) == 13), None),
            "publisher": next(iter(item.get("publisher") or []), None), "published_date": str(item.get("first_publish_year")) if item.get("first_publish_year") else None,
            "info_url": f"https://openlibrary.org{item.get('key')}" if item.get("key") else None,
            "cover_url": f"https://covers.openlibrary.org/b/id/{item['cover_i']}-L.jpg?default=false" if item.get("cover_i") else None,
        })
    return candidates


def download_candidate(candidate: dict, cache_key: str) -> tuple[dict | None, str | None]:
    url = candidate.get("cover_url")
    if not url:
        return None, "candidate has no cover URL"
    path = cache_dir / "images" / f"{cache_key}-{candidate['provider']}-{candidate.get('provider_id') or 'unknown'}.img"
    if path.exists():
        body = path.read_bytes()
        content_type = None
    else:
        request = urllib.request.Request(url.replace("http:", "https:"), headers={"User-Agent": agent, "Accept": "image/*"})
        try:
            with urllib.request.urlopen(request, timeout=25) as handle:
                body = handle.read()
                content_type = handle.headers.get("content-type")
            path.write_bytes(body)
            time.sleep(0.2)
        except Exception as exc:
            return None, f"{type(exc).__name__}: {exc}"
    try:
        image = Image.open(io.BytesIO(body))
        image.verify()
        verified = Image.open(io.BytesIO(body))
        if verified.width < 80 or verified.height < 100:
            raise ValueError(f"cover too small: {verified.size}")
        extension = "jpg" if (verified.format or "JPEG").lower() in {"jpg", "jpeg"} else (verified.format or "png").lower()
        return {"cache_path": str(path), "extension": extension, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "mime_type": content_type or Image.MIME.get(verified.format), "width": verified.width, "height": verified.height}, None
    except Exception as exc:
        return None, f"{type(exc).__name__}: {exc}"


def unresolved_reason(metadata: dict, candidates: list[dict], errors: list[str]) -> str:
    source = metadata["source"]
    status = metadata["match"]["status"]
    exact_isbn = metadata["identifiers_extracted"].get("isbn_10_candidate_from_source_url")
    if any("429" in error or "rate" in error.lower() for error in errors):
        return "rate_limit_artifact"
    if not source.get("displayed_author"):
        return "missing_author_metadata"
    if status in {"catalog_matched", "high_confidence_partial"} and exact_isbn and candidates:
        return "genuinely_unavailable_cover"
    if status in {"catalog_matched", "high_confidence_partial"}:
        return "confident_identity_cover_not_found"
    title = source["title_displayed"]
    if title != metadata["canonical"]["title"] or "/" in title or any(warning.get("code") == "title_typo" for warning in source.get("source_warnings", []) if isinstance(warning, dict)):
        return "source_title_normalization_problem"
    scored = [candidate for candidate in candidates if candidate.get("_title_score", 0) >= 0.72]
    if len(normalize(title).split()) <= 2 and len(scored) > 1:
        return "ambiguous_title"
    if scored:
        return "edition_or_identity_ambiguity"
    return "unusual_or_independent_publication"


records = []
placeholder_paths = []
for metadata_path in sorted(metadata_dir.glob("*.metadata.v1.json")):
    metadata = json.loads(metadata_path.read_text())
    if (metadata.get("cover") or {}).get("status") == "cached":
        continue
    placeholder_paths.append(metadata_path)
    source = metadata["source"]
    query_title = metadata["canonical"]["title"] or source["title_displayed"]
    query_author = source.get("displayed_author") or ""
    isbn = metadata["identifiers_extracted"].get("isbn_10_candidate_from_source_url")
    query = f"isbn:{isbn}" if isbn else f'intitle:"{query_title}" inauthor:"{query_author}"'
    google_key = os.environ.get("GOOGLE_BOOKS_API_KEY")
    google_cache = cache_dir / "responses" / f"{metadata['source_position']:03d}-google.json"
    url = "https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode({"q": query, "maxResults": 20, "printType": "books", "projection": "full", **({"key": google_key} if google_key else {})})
    if google_key:
        google, google_error = fetch_json(url, google_cache)
    else:
        cached = json.loads(google_cache.read_text()) if google_cache.exists() else {}
        google, google_error = cached.get("response"), cached.get("error") or "Google Books skipped: no quota-bearing API key configured in the process environment."
    candidates = google_candidates(google) + open_library_candidates(metadata)
    existing_candidate = metadata.get("match", {}).get("candidate") or {}
    if existing_candidate.get("provider") == "open_library" and existing_candidate.get("cover_url"):
        candidates.append(dict(existing_candidate))
    if isbn:
        candidates.append({
            "provider": "open_library", "provider_id": f"isbn-{isbn}", "title": source["title_displayed"],
            "subtitle": metadata["canonical"].get("subtitle"), "authors": [source["displayed_author"]] if source.get("displayed_author") else [],
            "isbn_10": isbn, "isbn_13": metadata["canonical"].get("isbn_13"), "publisher": metadata["canonical"].get("publisher"),
            "published_date": metadata["canonical"].get("published_date"), "info_url": f"https://openlibrary.org/isbn/{isbn}",
            "cover_url": f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false",
        })
    deduped = []
    seen = set()
    for candidate in candidates:
        key = (candidate["provider"], candidate.get("provider_id"), candidate.get("cover_url"))
        if key in seen:
            continue
        seen.add(key)
        candidate["_title_score"] = round(title_score(source["title_displayed"], candidate.get("title")), 4)
        candidate["_author_score"] = round(author_score(source.get("displayed_author"), candidate.get("authors") or []), 4)
        candidate["_exact_isbn"] = bool(isbn and isbn in {candidate.get("isbn_10"), candidate.get("isbn_13")})
        candidate["_score"] = round(0.72 * candidate["_title_score"] + 0.23 * candidate["_author_score"] + (0.05 if candidate["_exact_isbn"] else 0), 4)
        deduped.append(candidate)
    deduped.sort(key=lambda item: (bool(item.get("cover_url")), item["_score"], item["_title_score"], item["_author_score"]), reverse=True)
    eligible = [candidate for candidate in deduped if candidate.get("cover_url") and candidate["_author_score"] >= 0.84 and ((candidate["_exact_isbn"] and candidate["_title_score"] >= 0.7) or (candidate["_title_score"] >= 0.9 and candidate["_score"] >= 0.85))]
    accepted, image_info = None, None
    errors = [google_error] if google_error else []
    for candidate in eligible:
        image_info, error = download_candidate(candidate, f"{metadata['source_position']:03d}")
        if image_info:
            accepted = candidate
            break
        if error:
            errors.append(error)
    reason = "recovered_confident_match" if accepted else unresolved_reason(metadata, deduped, errors)
    review = {
        "source_position": metadata["source_position"], "slug": metadata["slug"], "source_title": source["title_displayed"],
        "source_author": source.get("displayed_author"), "previous_metadata_status": metadata["match"]["status"],
        "reason": reason, "accepted_candidate": accepted, "image": image_info,
        "candidate_count": len(deduped), "eligible_candidate_count": len(eligible), "provider_errors": errors,
        "top_candidates": deduped[:5],
    }
    records.append(review)
    metadata["cover_recovery"] = {"schema_version": "book-cover-recovery.v1", **review, "applied": bool(apply_changes and accepted)}
    if apply_changes and accepted and image_info:
        destination = cover_dir / f"{metadata['slug']}.{image_info['extension']}"
        shutil.copyfile(image_info["cache_path"], destination)
        metadata["cover"] = {
            "status": "cached", "public_path": f"/book-covers/{destination.name}", "source_url": accepted["cover_url"],
            "provider": accepted["provider"], "provider_id": accepted.get("provider_id"), "bytes": image_info["bytes"],
            "sha256": image_info["sha256"], "mime_type": image_info["mime_type"], "width": image_info["width"], "height": image_info["height"],
        }
        metadata["warnings"] = [warning for warning in metadata.get("warnings", []) if warning != "No confidently matched real cover; use the local Library placeholder."]
        metadata["warnings"].append("Cover recovered in the strict multi-provider recovery pass; review provenance before approval.")
    if apply_changes:
        metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False) + "\n")

counts = Counter(record["reason"] for record in records)
report = {
    "schema_version": "books-cover-recovery-report.v1", "generated_at": datetime.now(timezone.utc).isoformat(),
    "applied": apply_changes, "before": {"real_covers": 165 - len(placeholder_paths), "placeholders": len(placeholder_paths)},
    "recovered": sum(record["accepted_candidate"] is not None for record in records),
    "after": {"real_covers": 165 - len(placeholder_paths) + sum(record["accepted_candidate"] is not None for record in records), "placeholders": len(placeholder_paths) - sum(record["accepted_candidate"] is not None for record in records)},
    "remaining_reasons": dict(sorted((reason, count) for reason, count in counts.items() if reason != "recovered_confident_match")),
    "records": records,
    "policies": {"amazon_images_scraped": False, "strict_title_author_agreement": True, "provider_responses_cached": True, "incorrect_cover_preferred_over_placeholder": False},
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
if apply_changes:
    manifest_path = metadata_dir.parent / "metadata-corpus-manifest.v1.json"
    manifest = json.loads(manifest_path.read_text())
    current = {json.loads(path.read_text())["source_position"]: json.loads(path.read_text()) for path in metadata_dir.glob("*.metadata.v1.json")}
    for record in manifest["records"]:
        cover = current[record["source_position"]].get("cover") or {}
        record["cover_status"] = cover.get("status", "placeholder")
    manifest["cover_recovery"] = {"schema_version": report["schema_version"], "generated_at": report["generated_at"], "recovered": report["recovered"], "report": str(report_path)}
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"applied": apply_changes, "before": report["before"], "recovered": report["recovered"], "after": report["after"], "remaining_reasons": report["remaining_reasons"]}, indent=2))
