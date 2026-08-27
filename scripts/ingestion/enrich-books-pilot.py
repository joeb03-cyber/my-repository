#!/usr/bin/env python3
"""Query public book catalogs, score candidates, and cache pilot cover images."""

from __future__ import annotations

import hashlib
import io
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

from PIL import Image


if len(sys.argv) != 4:
    raise SystemExit("Usage: enrich-books-pilot.py <inventory.json> <pilot-dir> <output-dir>")

inventory_path = Path(sys.argv[1])
pilot_dir = Path(sys.argv[2])
output_dir = Path(sys.argv[3])
metadata_dir = output_dir / "metadata"
provider_dir = output_dir / "provider-cache"
cover_dir = output_dir / "covers"
for directory in (metadata_dir, provider_dir, cover_dir):
    directory.mkdir(parents=True, exist_ok=True)

inventory = json.loads(inventory_path.read_text())
parser_manifest = json.loads((pilot_dir / "parser-pilot-manifest.v1.json").read_text())
inventory_by_position = {record["source_position"]: record for record in inventory["records"]}
user_agent = "SynergeticHumanBooksPilot/0.1 (local non-production metadata review)"


def normalize(value: str | None) -> str:
    if not value:
        return ""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def tokens(value: str | None) -> set[str]:
    return {token for token in normalize(value).split() if token not in {"the", "a", "an"}}


def similarity(left: str | None, right: str | None) -> float:
    if not left or not right:
        return 0.0
    left_normalized = normalize(left)
    right_normalized = normalize(right)
    sequence = SequenceMatcher(None, left_normalized, right_normalized).ratio()
    left_tokens = tokens(left)
    right_tokens = tokens(right)
    union = left_tokens | right_tokens
    jaccard = len(left_tokens & right_tokens) / len(union) if union else 0.0
    return max(sequence, jaccard)


def author_similarity(source_author: str | None, candidate_authors: list[str]) -> float:
    if not source_author or not candidate_authors:
        return 0.0
    source_variants = [source_author]
    source_variants.extend(re.split(r"\s+(?:&|and)\s+", source_author))
    return max(similarity(source, candidate) for source in source_variants for candidate in candidate_authors)


def valid_isbn10(value: str | None) -> bool:
    if not value or not re.fullmatch(r"\d{9}[\dX]", value):
        return False
    total = sum((10 - index) * (10 if character == "X" else int(character)) for index, character in enumerate(value))
    return total % 11 == 0


def source_identifiers(url: str):
    asin = re.search(r"/dp/([A-Z0-9]{10})(?:[/?]|$)", url, re.I)
    asin_value = asin.group(1).upper() if asin else None
    return {
        "asin": asin_value,
        "isbn_10_candidate_from_asin": asin_value if valid_isbn10(asin_value) else None,
    }


def clean_document_title(text: str, author: str | None) -> str:
    cleaned = re.sub(r"\s*(?:-|—)?\s*(?:complete\s+)?(?:book\s+)?(?:notes|highlights)(?:\s+and\s+exercises)?\s*$", "", text, flags=re.I)
    cleaned = re.sub(r"\s*[-—]\s*complete\s+notes\s+and\s+exercises\s*$", "", cleaned, flags=re.I)
    if author:
        cleaned = re.sub(rf"\s+by\s+{re.escape(author)}\s*$", "", cleaned, flags=re.I)
        cleaned = re.sub(rf"\s*[-—]\s*{re.escape(author)}\s*$", "", cleaned, flags=re.I)
    return cleaned.strip(" -—:")


def get_json(url: str):
    request = urllib.request.Request(url, headers={"User-Agent": user_agent, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8")), None
    except Exception as error:  # retain provider failures as provenance
        return None, f"{type(error).__name__}: {error}"


def google_candidate(item):
    info = item.get("volumeInfo", {})
    identifiers = {entry.get("type"): entry.get("identifier") for entry in info.get("industryIdentifiers", [])}
    return {
        "provider": "google_books",
        "provider_id": item.get("id"),
        "title": info.get("title"),
        "subtitle": info.get("subtitle"),
        "authors": info.get("authors", []),
        "isbn_10": identifiers.get("ISBN_10"),
        "isbn_13": identifiers.get("ISBN_13"),
        "publisher": info.get("publisher"),
        "published_date": info.get("publishedDate"),
        "subjects": info.get("categories", []),
        "language": info.get("language"),
        "info_url": info.get("infoLink"),
        "cover_links": info.get("imageLinks", {}),
    }


def open_library_candidate(item):
    isbns = item.get("isbn", [])
    return {
        "provider": "open_library",
        "provider_id": item.get("key"),
        "edition_ids": item.get("edition_key", [])[:10],
        "title": item.get("title"),
        "subtitle": item.get("subtitle"),
        "authors": item.get("author_name", []),
        "isbn_10": next((isbn for isbn in isbns if len(isbn) == 10), None),
        "isbn_13": next((isbn for isbn in isbns if len(isbn) == 13), None),
        "publisher": (item.get("publisher") or [None])[0],
        "published_date": str(item.get("first_publish_year")) if item.get("first_publish_year") else None,
        "subjects": (item.get("subject") or [])[:20],
        "language": None,
        "info_url": f"https://openlibrary.org{item.get('key')}" if item.get("key") else None,
        "cover_id": item.get("cover_i"),
    }


def score_candidate(candidate, title_variants, source_author, identifiers):
    title_score = max(similarity(title, candidate["title"]) for title in title_variants if title)
    author_score = author_similarity(source_author, candidate["authors"])
    source_isbn = identifiers["isbn_10_candidate_from_asin"]
    identifier_match = bool(source_isbn and source_isbn in {candidate.get("isbn_10"), candidate.get("isbn_13")})
    score = 0.64 * title_score + 0.31 * author_score + (0.05 if identifier_match else 0.0)
    if source_author and not candidate["authors"]:
        score *= 0.83
    return {
        **candidate,
        "score": round(min(score, 1.0), 4),
        "score_components": {
            "title_similarity": round(title_score, 4),
            "author_similarity": round(author_score, 4),
            "source_identifier_match": identifier_match,
        },
    }


def cover_source(candidates, selected):
    ranked = [selected] + [candidate for candidate in candidates if candidate is not selected]
    for candidate in ranked:
        if candidate["provider"] == "google_books" and candidate.get("cover_links"):
            for size in ("extraLarge", "large", "medium", "small", "thumbnail", "smallThumbnail"):
                if candidate["cover_links"].get(size):
                    original = candidate["cover_links"][size]
                    return {
                        "provider": "google_books",
                        "provider_id": candidate["provider_id"],
                        "provider_field": f"volumeInfo.imageLinks.{size}",
                        "source_url": original,
                        "fetch_url": re.sub(r"^http:", "https:", original),
                    }
        if candidate["provider"] == "open_library" and candidate.get("cover_id"):
            url = f"https://covers.openlibrary.org/b/id/{candidate['cover_id']}-L.jpg?default=false"
            return {
                "provider": "open_library",
                "provider_id": candidate["provider_id"],
                "provider_field": "cover_i",
                "source_url": url,
                "fetch_url": url,
            }
    return None


def download_cover(source, position, title):
    request = urllib.request.Request(source["fetch_url"], headers={"User-Agent": user_agent, "Accept": "image/*"})
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
        slug = re.sub(r"[^a-z0-9]+", "-", normalize(title)).strip("-")[:55]
        file_name = f"{position:03d}-{slug}.{extension}"
        file_path = cover_dir / file_name
        file_path.write_bytes(body)
        return {
            **{key: value for key, value in source.items() if key != "fetch_url"},
            "status": "cached",
            "local_path": f"covers/{file_name}",
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
        return {
            **{key: value for key, value in source.items() if key != "fetch_url"},
            "status": "download_failed",
            "error": f"{type(error).__name__}: {error}",
        }


manifest_records = []
for parser_record in parser_manifest["records"]:
    position = parser_record["source_position"]
    source = inventory_by_position[position]
    existing_metadata_path = metadata_dir / f"{position:03d}.metadata.v1.json"
    if existing_metadata_path.exists():
        existing = json.loads(existing_metadata_path.read_text())
        existing_cover = existing.get("cover_candidate")
        manifest_records.append(
            {
                "source_position": position,
                "source_title": source["title_displayed"],
                "canonical_title_suggestion": existing["canonical_metadata_suggestion"]["title"],
                "match_status": existing["match"]["status"],
                "top_score": existing["match"]["top_score"],
                "candidate_count": existing["match"]["candidate_count"],
                "cover_status": existing_cover["status"] if existing_cover else "none",
                "metadata_record": f"metadata/{existing_metadata_path.name}",
            }
        )
        continue
    parsed = json.loads((pilot_dir / parser_record["parsed_record"]).read_text())
    document_title_unit = next((unit for unit in parsed["units"] if unit["kind"] == "document_title"), None)
    document_title = clean_document_title(document_title_unit["text"], source["displayed_author"]) if document_title_unit else source["title_displayed"]
    title_variants = list(dict.fromkeys([source["title_displayed"], document_title]))
    identifiers = source_identifiers(source["external_book_url"])

    google_queries = []
    open_library_queries = []
    google_items = []
    open_library_items = []
    for title in [document_title]:
        google_q = f'intitle:"{title}"'
        if source["displayed_author"]:
            google_q += f' inauthor:"{source["displayed_author"]}"'
        google_url = "https://www.googleapis.com/books/v1/volumes?" + urllib.parse.urlencode(
            {"q": google_q, "maxResults": 10, "printType": "books"}
        )
        google_data, google_error = get_json(google_url)
        google_queries.append({"title_variant": title, "url": google_url, "error": google_error, "response": google_data})
        if google_data:
            google_items.extend(google_data.get("items", []))
        time.sleep(0.12)

        open_url = "https://openlibrary.org/search.json?" + urllib.parse.urlencode(
            {
                "title": title,
                "author": source["displayed_author"] or "",
                "limit": 10,
                "fields": "key,title,subtitle,author_name,isbn,publisher,first_publish_year,cover_i,edition_key,subject",
            }
        )
        open_data, open_error = get_json(open_url)
        open_library_queries.append({"title_variant": title, "url": open_url, "error": open_error, "response": open_data})
        if open_data:
            open_library_items.extend(open_data.get("docs", []))
        time.sleep(0.12)

    google_cache = provider_dir / f"{position:03d}-google-books.v1.json"
    open_cache = provider_dir / f"{position:03d}-open-library.v1.json"
    google_cache.write_text(json.dumps({"provider": "google_books", "queries": google_queries}, ensure_ascii=False, indent=2) + "\n")
    open_cache.write_text(json.dumps({"provider": "open_library", "queries": open_library_queries}, ensure_ascii=False, indent=2) + "\n")

    unique_google = {item.get("id"): item for item in google_items if item.get("id")}
    unique_open = {item.get("key"): item for item in open_library_items if item.get("key")}
    candidates = [
        score_candidate(google_candidate(item), title_variants, source["displayed_author"], identifiers)
        for item in unique_google.values()
    ] + [
        score_candidate(open_library_candidate(item), title_variants, source["displayed_author"], identifiers)
        for item in unique_open.values()
    ]
    candidates.sort(key=lambda candidate: candidate["score"], reverse=True)
    selected = candidates[0] if candidates else None
    runner_up = candidates[1] if len(candidates) > 1 else None
    margin = round(selected["score"] - runner_up["score"], 4) if selected and runner_up else None

    status = "unmatched"
    if selected:
        components = selected["score_components"]
        if selected["score"] >= 0.86 and components["title_similarity"] >= 0.82 and components["author_similarity"] >= 0.62:
            status = "high_confidence"
        elif selected["score"] >= 0.68:
            status = "ambiguous"
    accepted_for_cover = status == "high_confidence"
    selected_cover_source = cover_source(candidates, selected) if accepted_for_cover and selected else None
    cover = download_cover(selected_cover_source, position, selected["title"]) if selected_cover_source else None

    warnings = list(source.get("source_warnings", []))
    if source["title_displayed"] != document_title:
        warnings.append("document title differs from displayed bookshelf title")
    if status != "high_confidence":
        warnings.append("metadata match requires review before acceptance")
    if accepted_for_cover and not cover:
        warnings.append("high-confidence metadata match has no provider cover candidate")
    if cover and cover["status"] != "cached":
        warnings.append("cover candidate could not be cached")

    output = {
        "schema_version": "book-metadata-pilot.v1",
        "record_id": parsed["record_id"],
        "source_position": position,
        "source": {
            "title_displayed": source["title_displayed"],
            "author_displayed": source["displayed_author"],
            "external_book_url": source["external_book_url"],
            "highlights_url": source["highlights_url"],
            "document_title_observed": document_title,
            "identifiers_extracted": identifiers,
        },
        "provider_provenance": {
            "google_books_cache": f"../provider-cache/{google_cache.name}",
            "open_library_cache": f"../provider-cache/{open_cache.name}",
            "queries_use_public_catalog_endpoints": True,
            "amazon_scraped": False,
        },
        "match": {
            "status": status,
            "accepted_for_cover_pilot": accepted_for_cover,
            "top_score": selected["score"] if selected else None,
            "runner_up_score": runner_up["score"] if runner_up else None,
            "score_margin": margin,
            "selected_candidate": selected,
            "candidate_count": len(candidates),
            "top_candidates": candidates[:5],
            "scoring": "0.64 title similarity + 0.31 author similarity + 0.05 exact source ISBN-10 candidate match",
        },
        "canonical_metadata_suggestion": {
            "title": selected["title"] if selected else None,
            "subtitle": selected["subtitle"] if selected else None,
            "authors": selected["authors"] if selected else [],
            "isbn_10": selected["isbn_10"] if selected else None,
            "isbn_13": selected["isbn_13"] if selected else None,
            "publisher": selected["publisher"] if selected else None,
            "published_date": selected["published_date"] if selected else None,
            "provider": selected["provider"] if selected else None,
            "provider_id": selected["provider_id"] if selected else None,
            "review_status": "suggested" if selected else "unresolved",
        },
        "cover_candidate": cover,
        "warnings": warnings,
    }
    metadata_path = metadata_dir / f"{position:03d}.metadata.v1.json"
    metadata_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    manifest_records.append(
        {
            "source_position": position,
            "source_title": source["title_displayed"],
            "canonical_title_suggestion": output["canonical_metadata_suggestion"]["title"],
            "match_status": status,
            "top_score": output["match"]["top_score"],
            "candidate_count": len(candidates),
            "cover_status": cover["status"] if cover else "none",
            "metadata_record": f"metadata/{metadata_path.name}",
        }
    )

manifest = {
    "schema_version": "bookshelf-metadata-cover-pilot-manifest.v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "record_count": len(manifest_records),
    "records": manifest_records,
}
(output_dir / "metadata-cover-pilot-manifest.v1.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
