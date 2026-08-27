#!/usr/bin/env python3
"""Build the public-safe Stage 10.5 delta and local Contacts fallback.

The reviewable candidate list is intentionally not projected into the public
Contacts index. Candidate records remain protected until Joe approves them.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PILOT = ROOT / "data/brain/people-sources/editorial-pilot.v1.json"
INDEX = ROOT / "data/brain/people-sources/index.v1.json"
BOOKS = ROOT / "data/brain/books-index.v1.json"
OUTPUT = ROOT / "data/brain/people-sources/import-editorial-pilot-v1"
NAMESPACE = uuid.UUID("1b8f42cc-c85c-56c1-ac70-b2e299179cd5")
ASSOCIATED_WITH = "72aa0428-73e9-5706-8279-8d7088595194"


def stable_id(kind: str, value: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{value}"))


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def write_jsonl(name: str, rows: list[dict]) -> None:
    (OUTPUT / name).write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows))


def main() -> int:
    pilot = json.loads(PILOT.read_text())
    current = json.loads(INDEX.read_text())
    books = json.loads(BOOKS.read_text())["books"]
    OUTPUT.mkdir(parents=True, exist_ok=True)

    books_by_author: dict[str, list[dict]] = {}
    for book in books:
        for author in book.get("authors") or []:
            books_by_author.setdefault(author.casefold(), []).append({
                "id": book["id"], "slug": book["slug"], "title": book["title"],
                "originalAuthor": author, "coverPath": (book.get("cover") or {}).get("public_path"),
            })
    appearances: dict[str, list[dict]] = {}
    for contact in current["contacts"]:
        appearances[contact["id"]] = contact.get("podcastAppearances", [])

    person_entities, topic_entities, topic_rows, relationships, people_rows = [], [], [], [], []
    portrait_assets, assertions, candidates = [], [], []
    new_contacts = {row["id"]: row for row in current["contacts"]}
    for person in pilot["people"]:
        entity_id = person["entityId"]
        person_entities.append({
            "id": entity_id, "kind": "person", "slug": f"person-{slugify(person['name'])}", "title": person["name"],
            "summary": None, "visibility": "public", "lifecycle_state": "active", "editorial_state": "approved",
        })
        topic_items = []
        for rank, topic in enumerate(person["topics"], 1):
            topic_id = stable_id("topic", topic["slug"])
            topic_entities.append({
                "id": topic_id, "kind": "topic", "slug": topic["slug"], "title": topic["label"],
                "summary": None, "visibility": "public", "lifecycle_state": "active", "editorial_state": "needs_review",
            })
            topic_rows.append({"entity_id": topic_id, "description": None, "taxonomy_version": "people-editorial-pilot-v1", "editorial_state": "suggested"})
            relationships.append({
                "id": stable_id("relationship", f"{entity_id}:associated_with:{topic_id}"),
                "from_entity_id": entity_id, "relationship_type_id": ASSOCIATED_WITH, "to_entity_id": topic_id,
                "confidence": 0.9, "rank": rank, "context": {"source": "contacts_editorial_pilot", "reviewable": True},
                "editorial_state": "suggested", "valid_from": None, "valid_to": None,
            })
            topic_items.append({"slug": topic["slug"], "label": topic["label"], "editorialState": "suggested"})

        portrait_id = None
        portrait = person.get("portrait")
        if portrait:
            portrait_id = stable_id("media-asset", portrait["sourceUrl"])
            file_path = ROOT / "public" / portrait["path"].lstrip("/")
            portrait_assets.append({
                "id": portrait_id, "kind": "image", "storage_path": portrait["path"], "source_url": portrait["sourceUrl"],
                "provider": "wikimedia_commons", "provider_identifier": "File:Rupert_Spira.jpg", "mime_type": "image/jpeg",
                "byte_size": file_path.stat().st_size if file_path.exists() else None, "width": 299, "height": 399,
                "sha256": hashlib.sha256(file_path.read_bytes()).hexdigest() if file_path.exists() else None,
                "confidence": 1, "editorial_state": "approved", "provenance": portrait,
            })
        people_rows.append({
            "entity_id": entity_id, "display_name": person["name"], "sort_name": None,
            "normalized_name": person["name"].casefold(), "initials": "".join(p[0] for p in person["name"].split()[:2]),
            "factual_identity": person["identity"], "identity_review_state": "approved", "contact_publication_state": "published",
            "factual_identity_source_url": person["identitySource"]["url"],
            "factual_identity_source_label": person["identitySource"]["label"],
            "factual_identity_retrieved_at": person["identitySource"]["retrievedAt"], "portrait_asset_id": portrait_id,
        })
        assertions.append({
            "id": stable_id("editorial-assertion", f"interesting:{entity_id}:joe_burt"), "target_entity_id": entity_id,
            "target_source_id": None, "context_entity_id": None, "assertion_type": "interesting", "approval_state": "approved",
            "context_domain": "contacts-editorial-pilot", "note": None, "asserted_by": "joe_burt", "endorsement": False,
            "visibility": "private", "provenance": {"source": "joe_manual_people_list", "meaning": "interesting_to_explore_not_endorsed"},
        })
        for position, candidate in enumerate(person["candidates"], 1):
            candidates.append({
                "id": stable_id("contact-source-candidate", f"{entity_id}:{position}:{candidate['title']}"),
                "person_entity_id": entity_id, "candidate_kind": candidate["kind"], "title": candidate["title"],
                "external_url": candidate.get("url"), "existing_entity_id": candidate.get("existingEntityId"),
                "existing_source_id": candidate.get("existingSourceId"), "approval_state": "suggested", "rank": position,
                "editorial_note": candidate.get("note"), "provenance": {"research_date": "2026-08-27", "relationship": candidate["relationship"]},
            })
        new_contacts[entity_id] = {
            "id": entity_id, "slug": f"person-{slugify(person['name'])}", "displayName": person["name"], "sortName": None,
            "initials": "".join(p[0] for p in person["name"].split()[:2]), "factualIdentity": person["identity"],
            "portrait": ({"path": portrait["path"], "alt": person["name"], "attribution": portrait["attribution"], "license": portrait["license"], "sourceUrl": portrait["sourceUrl"]} if portrait else None),
            "curatedInterest": True, "endorsement": False, "topics": topic_items,
            "books": books_by_author.get(person["name"].casefold(), []), "podcastAppearances": appearances.get(entity_id, []),
        }

    write_jsonl("person_entities.jsonl", person_entities)
    write_jsonl("topic_entities.jsonl", list({row["id"]: row for row in topic_entities}.values()))
    write_jsonl("topics.jsonl", list({row["entity_id"]: row for row in topic_rows}.values()))
    write_jsonl("relationships.jsonl", relationships)
    write_jsonl("people.jsonl", people_rows)
    write_jsonl("media_assets.jsonl", portrait_assets)
    write_jsonl("editorial_assertions.jsonl", assertions)
    write_jsonl("editorial_source_candidates.jsonl", candidates)

    current["schemaVersion"] = "brain-people-sources.editorial-pilot.v1"
    current["generatedFrom"] = "public-safe Stage 10 metadata plus five-profile editorial pilot"
    current["contacts"] = sorted(new_contacts.values(), key=lambda row: row["displayName"])
    current["contactCount"] = len(current["contacts"])
    INDEX.write_text(json.dumps(current, indent=2, ensure_ascii=False) + "\n")
    manifest = {"people": len(people_rows), "public_contacts": len(current["contacts"]), "topics": len(topic_rows), "portraits": len(portrait_assets), "private_candidates": len(candidates), "approved_start_here": 0}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
