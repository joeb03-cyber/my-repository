#!/usr/bin/env python3
"""Cached Open Library metadata/cover enrichment for the full Books corpus."""

from __future__ import annotations

import hashlib
import io
import json
import re
import shutil
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image

if len(sys.argv) != 6:
    raise SystemExit("Usage: enrich-books-corpus.py <inventory.json> <pilot-dir> <output-dir> <public-cover-dir> <cache-dir>")

inventory_path, pilot_dir, output_dir, cover_dir, cache_dir = map(Path, sys.argv[1:])
output_dir.mkdir(parents=True, exist_ok=True)
cover_dir.mkdir(parents=True, exist_ok=True)
cache_dir.mkdir(parents=True, exist_ok=True)
inventory = json.loads(inventory_path.read_text())
agent = "SynergeticHumanBooksImporter/1.0 (local development; cached; contact via site owner)"
corrections = {"Conscious Accomplishemnt": "Conscious Accomplishment", "Let if Flow": "Let It Flow", "Pouring Conrete": "Pouring Concrete"}


def normalize(value: str | None) -> str:
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize(value)).strip("-") or "untitled"


def similar(left: str | None, right: str | None) -> float:
    if not left or not right:
        return 0.0
    a, b = normalize(left), normalize(right)
    seq = SequenceMatcher(None, a, b).ratio()
    at, bt = set(a.split()) - {"the", "a", "an"}, set(b.split()) - {"the", "a", "an"}
    jac = len(at & bt) / len(at | bt) if at | bt else 0
    return max(seq, jac)


def valid_isbn10(value: str | None) -> bool:
    if not value or not re.fullmatch(r"\d{9}[\dX]", value):
        return False
    return sum((10 - i) * (10 if c == "X" else int(c)) for i, c in enumerate(value)) % 11 == 0


def source_isbn(url: str | None) -> str | None:
    match = re.search(r"/dp/([A-Z0-9]{10})(?:[/?]|$)", url or "", re.I)
    value = match.group(1).upper() if match else None
    return value if valid_isbn10(value) else None


def fetch_json(url: str, cache_path: Path) -> tuple[dict | None, str | None]:
    if cache_path.exists():
        cached = json.loads(cache_path.read_text())
        return cached.get("response"), cached.get("error")
    request = urllib.request.Request(url, headers={"User-Agent": agent, "Accept": "application/json"})
    response_data, error = None, None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                response_data = json.loads(response.read().decode("utf-8"))
            break
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"
            time.sleep(0.7 * (attempt + 1))
    cache_path.write_text(json.dumps({"url": url, "retrieved_at": datetime.now(timezone.utc).isoformat(), "response": response_data, "error": error}, indent=2, ensure_ascii=False) + "\n")
    time.sleep(0.18)
    return response_data, error


def candidate_from_isbn(data: dict, isbn: str) -> dict | None:
    item = data.get(f"ISBN:{isbn}") if data else None
    if not item:
        return None
    return {
        "provider": "open_library",
        "provider_id": item.get("key", "").split("/")[-1] or None,
        "title": item.get("title"),
        "subtitle": item.get("subtitle"),
        "authors": [author.get("name") for author in item.get("authors", []) if author.get("name")],
        "isbn_10": isbn,
        "isbn_13": next(iter(item.get("identifiers", {}).get("isbn_13", [])), None),
        "publisher": next((publisher.get("name") for publisher in item.get("publishers", []) if publisher.get("name")), None),
        "published_date": item.get("publish_date"),
        "info_url": item.get("url"),
        "cover_url": item.get("cover", {}).get("large") or f"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg?default=false",
        "match_method": "exact_source_isbn_10",
    }


def candidate_from_search(data: dict) -> dict | None:
    docs = (data or {}).get("docs") or []
    if not docs:
        return None
    item = docs[0]
    isbns = item.get("isbn") or []
    return {
        "provider": "open_library",
        "provider_id": (item.get("key") or "").split("/")[-1] or None,
        "title": item.get("title"),
        "subtitle": item.get("subtitle"),
        "authors": item.get("author_name") or [],
        "isbn_10": next((value for value in isbns if len(value) == 10), None),
        "isbn_13": next((value for value in isbns if len(value) == 13), None),
        "publisher": next(iter(item.get("publisher") or []), None),
        "published_date": str(item.get("first_publish_year")) if item.get("first_publish_year") else None,
        "info_url": f"https://openlibrary.org{item.get('key')}" if item.get("key") else None,
        "cover_url": f"https://covers.openlibrary.org/b/id/{item['cover_i']}-L.jpg?default=false" if item.get("cover_i") else None,
        "match_method": "title_author_search",
    }


def score_candidate(source: dict, candidate: dict | None, exact_isbn: bool) -> tuple[float, dict]:
    if not candidate:
        return 0.0, {"title_similarity": 0, "author_similarity": 0, "exact_source_identifier": exact_isbn}
    title_score = similar(corrections.get(source["title_displayed"], source["title_displayed"]), candidate.get("title"))
    author_score = max((similar(source.get("displayed_author"), author) for author in candidate.get("authors", [])), default=0)
    score = 0.68 * title_score + 0.27 * author_score + (0.05 if exact_isbn else 0)
    return round(score, 4), {"title_similarity": round(title_score, 4), "author_similarity": round(author_score, 4), "exact_source_identifier": exact_isbn}


def author_identity_agrees(source_author: str | None, candidate_authors: list[str]) -> bool:
    if not source_author:
        return True
    source_parts = [part.strip() for part in re.split(r"\s+(?:&|and)\s+|,", source_author, flags=re.I) if part.strip()]
    source_last_names = {normalize(part).split()[-1] for part in source_parts if normalize(part)}
    candidate_last_names = {normalize(author).split()[-1] for author in candidate_authors if normalize(author)}
    return bool(source_last_names & candidate_last_names)


def download_cover(url: str, path: Path, provenance: dict) -> dict:
    request = urllib.request.Request(url.replace("http:", "https:"), headers={"User-Agent": agent, "Accept": "image/*"})
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read()
            content_type = response.headers.get("content-type")
        image = Image.open(io.BytesIO(body))
        image.verify()
        verified = Image.open(io.BytesIO(body))
        if verified.width < 80 or verified.height < 100:
            raise ValueError(f"cover too small: {verified.size}")
        extension = "jpg" if (verified.format or "JPEG").lower() in {"jpg", "jpeg"} else (verified.format or "png").lower()
        final_path = path.with_suffix(f".{extension}")
        final_path.write_bytes(body)
        return {
            "status": "cached",
            "public_path": f"/book-covers/{final_path.name}",
            "source_url": url,
            "provider": provenance["provider"],
            "provider_id": provenance.get("provider_id"),
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "mime_type": content_type,
            "width": verified.width,
            "height": verified.height,
        }
    except Exception as exc:
        return {"status": "unavailable", "source_url": url, "error": f"{type(exc).__name__}: {exc}"}


slug_counts: dict[str, int] = {}
records = []
for index, source in enumerate(inventory["records"], 1):
    position = source["source_position"]
    title = corrections.get(source["title_displayed"], source["title_displayed"])
    base_slug = slugify(title)
    slug_counts[base_slug] = slug_counts.get(base_slug, 0) + 1
    slug = base_slug if slug_counts[base_slug] == 1 else f"{base_slug}-{position}"
    pilot_path = pilot_dir / "metadata" / f"{position:03d}.metadata.v1.json"
    pilot = json.loads(pilot_path.read_text()) if pilot_path.exists() else None
    pilot_status = pilot.get("match", {}).get("status") if pilot else None
    use_pilot = pilot_status in {"high_confidence", "high_confidence_fallback", "high_confidence_partial"}
    candidate = None
    provider_error = None
    exact_isbn = source_isbn(source.get("external_book_url"))

    if use_pilot:
        meta = pilot["canonical_metadata_suggestion"]
        candidate = {
            "provider": meta.get("provider"), "provider_id": meta.get("provider_id"), "title": meta.get("title"),
            "subtitle": meta.get("subtitle"), "authors": meta.get("authors") or [], "isbn_10": meta.get("isbn_10"),
            "isbn_13": meta.get("isbn_13"), "publisher": meta.get("publisher"), "published_date": meta.get("published_date"),
            "info_url": next(iter(pilot.get("provider_provenance", {}).get("curated_fallback_urls", [])), None), "cover_url": None,
            "match_method": "accepted_pilot_metadata",
        }
        score = pilot["match"].get("top_score") or 0.9
        components = {"accepted_pilot_metadata": True}
    else:
        if exact_isbn:
            url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{exact_isbn}&jscmd=data&format=json"
            data, provider_error = fetch_json(url, cache_dir / f"{position:03d}-isbn.json")
            candidate = candidate_from_isbn(data or {}, exact_isbn)
        if not candidate:
            query = urllib.parse.urlencode({"title": title, "author": source.get("displayed_author") or "", "limit": 5, "fields": "key,title,subtitle,author_name,isbn,publisher,first_publish_year,cover_i"})
            data, provider_error = fetch_json(f"https://openlibrary.org/search.json?{query}", cache_dir / f"{position:03d}-search.json")
            candidate = candidate_from_search(data or {})
        score, components = score_candidate(source, candidate, bool(exact_isbn and candidate and candidate.get("match_method") == "exact_source_isbn_10"))

    author_agrees = bool(candidate and author_identity_agrees(source.get("displayed_author"), candidate.get("authors") or []))
    if use_pilot:
        status = "catalog_matched" if pilot_status in {"high_confidence", "high_confidence_fallback"} else "high_confidence_partial"
    elif candidate and score >= 0.82 and author_agrees:
        status = "catalog_matched"
    elif candidate and score >= 0.7 and author_agrees:
        status = "high_confidence_partial"
    else:
        status = "source_only"

    accepted = status in {"catalog_matched", "high_confidence_partial"}
    canonical = {
        "title": candidate.get("title") if accepted and candidate and candidate.get("title") else title,
        "subtitle": candidate.get("subtitle") if accepted and candidate else None,
        "authors": candidate.get("authors") if accepted and candidate and candidate.get("authors") else ([source["displayed_author"]] if source.get("displayed_author") else []),
        "isbn_10": candidate.get("isbn_10") if accepted and candidate else exact_isbn,
        "isbn_13": candidate.get("isbn_13") if accepted and candidate else None,
        "publisher": candidate.get("publisher") if accepted and candidate else None,
        "published_date": candidate.get("published_date") if accepted and candidate else None,
    }

    cover = None
    if use_pilot and (pilot.get("cover_candidate") or {}).get("status") == "cached":
        source_cover = pilot_dir / pilot["cover_candidate"]["local_path"]
        extension = source_cover.suffix.lower() or ".jpg"
        destination = cover_dir / f"{slug}{extension}"
        shutil.copyfile(source_cover, destination)
        with Image.open(destination) as image:
            cover = {
                "status": "cached", "public_path": f"/book-covers/{destination.name}",
                "source_url": pilot["cover_candidate"].get("source_url"), "provider": pilot["cover_candidate"].get("provider"),
                "provider_id": pilot["cover_candidate"].get("provider_id"), "bytes": destination.stat().st_size,
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "mime_type": pilot["cover_candidate"].get("content_type"),
                "width": image.width, "height": image.height,
            }
    elif candidate and accepted and score >= 0.86 and candidate.get("cover_url"):
        cover = download_cover(candidate["cover_url"], cover_dir / slug, candidate)

    warnings = list(source.get("source_warnings") or [])
    if candidate and not accepted:
        warnings.append("Provider candidate did not meet the acceptance threshold; source-derived display metadata retained.")
    if candidate and not author_agrees:
        warnings.append("Provider author identity did not agree with the source author; candidate metadata and cover were not accepted.")
    if not cover or cover.get("status") != "cached":
        warnings.append("No confidently matched real cover; use the local Library placeholder.")
    record = {
        "schema_version": "book-metadata-corpus.v1",
        "source_position": position,
        "slug": slug,
        "source": source,
        "identifiers_extracted": {"isbn_10_candidate_from_source_url": exact_isbn},
        "match": {"status": status, "score": round(float(score), 4), "score_components": components, "candidate": candidate, "provider_error": provider_error},
        "canonical": canonical,
        "cover": cover,
        "warnings": warnings,
        "provenance": {"amazon_images_scraped": False, "pilot_metadata_reused": use_pilot, "provider_cache": str(cache_dir)},
    }
    (output_dir / f"{position:03d}.metadata.v1.json").write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n")
    records.append({"source_position": position, "slug": slug, "source_title": source["title_displayed"], "canonical_title": canonical["title"], "status": status, "score": record["match"]["score"], "cover_status": cover.get("status") if cover else "placeholder"})
    if index % 10 == 0:
        print(f"enriched {index}/{len(inventory['records'])}", file=sys.stderr)

manifest = {
    "schema_version": "bookshelf-metadata-corpus-manifest.v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "record_count": len(records),
    "records": records,
    "notes": ["All provider responses are cached.", "Amazon images were not scraped.", "A missing cover is intentional and must render with the local placeholder."],
}
(output_dir.parent / "metadata-corpus-manifest.v1.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({"records": len(records), "catalog_matched": sum(r["status"] == "catalog_matched" for r in records), "partial": sum(r["status"] == "high_confidence_partial" for r in records), "source_only": sum(r["status"] == "source_only" for r in records), "covers": sum(r["cover_status"] == "cached" for r in records)}, indent=2))
