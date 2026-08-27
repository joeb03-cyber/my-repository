#!/usr/bin/env python3
"""Build the public-safe Stage 10 People + Podcast staging snapshot.

The constants below are an editorial projection of already-discovered metadata.
No private archive paths, source bodies, summaries, or personal material are read
or written by this script.
"""

from __future__ import annotations

import json
import re
import unicodedata
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data/brain/people-sources/import-v1"
PUBLIC_INDEX = ROOT / "data/brain/people-sources/index.v1.json"
NAMESPACE = uuid.UUID("1b8f42cc-c85c-56c1-ac70-b2e299179cd5")


MANUAL_PEOPLE = [
    ("Diet/Nutrition", "Ray Peat", "Ray Peat"),
    ("Diet/Nutrition", "Alan Aragon", "Alan Aragon"),
    ("Diet/Nutrition", "Chris Masterjohn", "Chris Masterjohn"),
    ("Diet/Nutrition", "Paul Saladino", "Paul Saladino"),
    ("Diet/Nutrition", "Bryce Hanna", "Bryce Hanna"),
    ("Fitness/Exercise", "Andy Galpin", "Andy Galpin"),
    ("Fitness/Exercise", "Brad Schoenfeld", "Brad Schoenfeld"),
    ("Fitness/Exercise", "Ben Greenfield", "Ben Greenfield"),
    ("Fitness/Exercise", "Dr. Mike T. Nelson", "Mike T. Nelson"),
    ("Movement/Mobility", "Zac Cupples", "Zac Cupples"),
    ("Movement/Mobility", "Aleena Kanner", "Aleena Kanner"),
    ("Movement/Mobility", "Dr. Eric Goodman", "Eric Goodman"),
    ("Movement/Mobility", "Ben Patrick", "Ben Patrick"),
    ("Movement/Mobility", "Perry Nickelston", "Perry Nickelston"),
    ("Movement/Mobility", "Kelly Starrett", "Kelly Starrett"),
    ("Nervous system/Trauma/Inner work", "Joe Hudson", "Joe Hudson"),
    ("Nervous system/Trauma/Inner work", "Henry Shukman", "Henry Shukman"),
    ("Nervous system/Trauma/Inner work", "Irene Lyon", "Irene Lyon"),
    ("Nervous system/Trauma/Inner work", "Peter Levine", "Peter Levine"),
    ("Nervous system/Trauma/Inner work", "Dr. Aimie Apigian", "Aimie Apigian"),
    ("Nervous system/Trauma/Inner work", "Dr. Douglas Tataryn", "Douglas Tataryn"),
    ("Nervous system/Trauma/Inner work", "Gabor Mate", "Gabor Maté"),
    ("Nervous system/Trauma/Inner work", "Joe Dispenza", "Joe Dispenza"),
    ("Nervous system/Trauma/Inner work", "Richard Schwartz", "Richard Schwartz"),
    ("Nervous system/Trauma/Inner work", "Stephen Borges", "Stephen Porges"),
    ("Nervous system/Trauma/Inner work", "Robert Falconer", "Robert Falconer"),
    ("Alternative health/GNM", "Paul Leendertse", "Paul Leendertse"),
    ("Alternative health/GNM", "Tom Hughes (TCM)", "Tom Hughes"),
    ("Alternative health/GNM", "Brandon Bozarth", "Brandon Bozarth"),
    ("Alternative health/GNM", "Melissa Sell", "Melissa Sell"),
    ("Alternative health/GNM", "Dr. Hamer of GNM", "Ryke Geerd Hamer"),
    ("Biofield/Electric biology", "Eileen McCusick", "Eileen Day McKusick"),
    ("Biofield/Electric biology", "Shamini Jaim", "Shamini Jain"),
    ("Biofield/Electric biology", "Dr. Michael Levin", "Michael Levin"),
    ("Homeopathy", "Melissa Kupsch (homeopathy)", "Melissa Kupsch"),
    ("Light/EMF/Circadian", "Dr. Alexander Wusch", "Alexander Wunsch"),
    ("Light/EMF/Circadian", "Scott Zimmerman", "Scott Zimmerman"),
    ("Light/EMF/Circadian", "Jacob Liberman", "Jacob Liberman"),
    ("Light/EMF/Circadian", "Dr. Glen Jeffery", "Glen Jeffery"),
    ("Light/EMF/Circadian", "Nicolas Pineault", "Nicolas Pineault"),
    ("Light/EMF/Circadian", "Author of Invisible Rainbow, Arthur firstenberg", "Arthur Firstenberg"),
    ("Light/EMF/Circadian", "Jack Kruse", "Jack Kruse"),
    ("Terrain Theory", "Dr. Tom Cowan", "Tom Cowan"),
    ("Terrain Theory", "Marizelle Arce", "Marizelle Arce"),
    ("Terrain Theory", "Daniel Roy’s", "Daniel Roytas"),
    ("Health/Other", "Dr. Steven Young", "Steven Young"),
    ("Health/Other", "Owen Benjamin", "Owen Benjamin"),
    ("Health/Other", "Madhava Setty", "Madhava Setty"),
    ("Health/Other", "Fred Dodson", "Frederick Dodson"),
    ("Consciousness/Frontier", "Gregg Braden", "Gregg Braden"),
    ("Consciousness/Frontier", "Dean Radin", "Dean I. Radin"),
    ("Consciousness/Frontier", "Bruce Lipton", "Bruce Lipton"),
    ("Consciousness/Frontier", "Lynne McTaggart", "Lynne McTaggart"),
    ("Spirituality/Philosophy", "Kapil Gupta", "Kapil Gupta"),
    ("Spirituality/Philosophy", "Rupert Spira", "Rupert Spira"),
    ("Spirituality/Philosophy", "Adyashanti", "Adyashanti"),
    ("Spirituality/Philosophy", "David Hawkins", "David R. Hawkins"),
    ("Spirituality/Philosophy", "Yogananda", "Paramahansa Yogananda"),
    ("Foundational thinkers", "Wilhelm Reich", "Wilhelm Reich"),
    ("Foundational thinkers", "Hans Selye", "Hans Selye"),
    ("Foundational thinkers", "Ellen Langer", "Ellen J. Langer"),
    ("Foundational thinkers", "Erich Fromm", "Erich Fromm"),
]

APPROVED_CORRECTIONS = {
    "Stephen Borges", "Shamini Jaim", "Eileen McCusick",
    "Dr. Alexander Wusch", "Daniel Roy’s", "Dr. Hamer of GNM",
}

EXISTING_PERSON_IDS = {
    "Peter Levine": "d654e2cb-80bf-559d-8082-00ee40d35686",
    "Gabor Maté": "9f207979-4796-57a3-8ddd-a731a97ccbd6",
    "Joe Dispenza": "cc8da080-d469-55e0-9be2-9cf17cbd3b36",
    "Richard Schwartz": "f4dbd5f5-3d0d-5561-abe1-0347fe0112ab",
    "Stephen Porges": "a9b9c2d6-8242-5b02-9eda-8cfcfc2e435c",
    "Robert Falconer": "7656f84f-7f2e-5e13-b494-180282ad62c5",
    "Eileen Day McKusick": "f36f1c56-df91-55fe-b16e-38a9bcb4bb36",
    "Arthur Firstenberg": "7f0b9df1-5d88-5281-803f-11a7be803e03",
    "Steven Young": "c9764e5d-678c-5c39-af8c-955d9c3e41bb",
    "Frederick Dodson": "739e1dbd-22b1-5286-a13d-4ddd95599a88",
    "Gregg Braden": "536be3e0-cd57-56b4-bd94-07fe27d3aef9",
    "Dean I. Radin": "17fb9b89-c78e-5899-b1f8-2229cecaeb66",
    "Lynne McTaggart": "60742c2d-3682-5210-a322-14ed11ed9d76",
    "Kapil Gupta": "489d1644-2821-5a4e-9df9-51f000429b5c",
    "Rupert Spira": "552d34ad-7dc4-593c-807e-2ba4aad71894",
    "Adyashanti": "2afa5f1a-a507-52ac-a80f-916e23d81509",
    "David R. Hawkins": "4e2ccf28-90ce-5131-9630-478be6ec80ad",
    "Paramahansa Yogananda": "30e636a1-299a-596a-9572-a2dd6ff68630",
    "Wilhelm Reich": "3640be1a-d721-5c84-ada8-9b58d7e9ba01",
    "Ellen J. Langer": "cdf1a831-193a-5ba3-8135-19ba2e7ac006",
    "Erich Fromm": "2cf8b751-81c1-57fe-bcfb-f73467555d6c",
}

SELECTED_TOPICS = {
    "Chris Masterjohn": ["health-longevity"],
    "Zac Cupples": ["health-longevity"],
    "Peter Levine": ["psychology-trauma-inner-work"],
    "Stephen Porges": ["psychology-trauma-inner-work"],
    "Irene Lyon": ["psychology-trauma-inner-work"],
    "Kapil Gupta": ["philosophy-meaning", "consciousness-nonduality"],
    "Eileen Day McKusick": ["energy-esoteric-healing", "health-longevity"],
    "Shamini Jain": ["energy-esoteric-healing", "health-longevity"],
    "Jacob Liberman": ["consciousness-nonduality", "health-longevity"],
    "Madhava Setty": ["health-longevity", "society-culture-systems"],
    "Aleena Kanner": ["health-longevity"],
    "Daniel Roytas": ["health-longevity", "society-culture-systems"],
    "Lynne McTaggart": ["consciousness-nonduality", "energy-esoteric-healing"],
    "Marizelle Arce": ["health-longevity"],
    "Erich Fromm": ["psychology-trauma-inner-work", "philosophy-meaning"],
}

TOPICS = {
    "consciousness-nonduality": ("9152c14d-4ce9-54f9-926f-d069964c3da0", "Consciousness & Nonduality"),
    "psychology-trauma-inner-work": ("a8edaa81-99f8-5819-a92c-8e16d72328b3", "Psychology, Trauma & Inner Work"),
    "health-longevity": ("c72bc087-9e28-5bd7-908b-baf28ec675ee", "Health, Biology & Longevity"),
    "energy-esoteric-healing": ("6e83bfb8-e94d-514a-b1e5-a4ec87f3a209", "Energy & Esoteric Healing"),
    "philosophy-meaning": ("96cbba13-ce25-53f6-96f7-f98488778de0", "Philosophy & Meaning"),
    "society-culture-systems": ("39f67615-c013-56fb-9e82-4ead17466ca2", "Society, Culture & Systems"),
}

SHOWS = [
    {"slug": "alfacast-podcast", "title": "Alfacast Podcast"},
    {"slug": "the-way-forward-podcast", "title": "The Way Forward Podcast"},
    {"slug": "wonderjunkie-podcast", "title": "Wonderjunkie Podcast"},
]

EPISODES = [
    ("alfacast-podcast", "Jacob Liberman: Shining the Light of Mind", "2025-10-09", "01:44:22", "https://www.youtube.com/watch?v=wh_sOFrIn54", [("host", "Mike Winner", None), ("host", "Dr. Bear Paul Lando", None), ("guest", "Dr. Jacob Liberman", "Jacob Liberman")]),
    ("alfacast-podcast", "Marizelle Arce: Germs Are Not Our Enemy", "2025-10-23", "01:42:32", "https://www.youtube.com/watch?v=5lXiSiiQ-KA", [("host", "Mike Winner", None), ("host", "Dr. Barre Paul Lando", None), ("guest", "Marizelle Arce, N.D.", "Marizelle Arce")]),
    ("the-way-forward-podcast", "Aleena Kanner", "2025-10-29", "02:18:36", "https://www.youtube.com/watch?v=7FfeAV7595s", [("host", "Alec Zeck", None), ("guest", "Aleena Kanner", "Aleena Kanner")]),
    ("the-way-forward-podcast", "Brandon Bozarth", "2024-04-14", "01:42:26", "https://www.youtube.com/watch?v=5k1oMTHijbw", [("host", "Alec Zeck", None), ("guest", "Brandon Bozarth", "Brandon Bozarth")]),
    ("the-way-forward-podcast", "Daniel Roytas", "2024-04-17", "01:31:05", "https://www.youtube.com/watch?v=7lkSyBnFZvc", [("host", "Alec Zeck", None), ("guest", "Daniel Roytas", "Daniel Roytas")]),
    ("the-way-forward-podcast", "Dr. Steven Young", "2024-08-19", "02:07:48", "https://www.youtube.com/watch?v=YOeZcIOUMas", [("host", "Alec Zeck", None), ("guest", "Dr. Steve Young", "Steven Young")]),
    ("the-way-forward-podcast", "Eileen McKusick", "2024-04-27", "02:01:53", "https://www.youtube.com/watch?v=Sq3JiaUfn8I", [("host", "Alec Zeck", None), ("guest", "Eileen Day McKusick", "Eileen Day McKusick")]),
    ("the-way-forward-podcast", "Irene Lyon", "2024-12-31", "03:30:28", "https://www.youtube.com/watch?v=wsus8eKxahI", [("host", "Alec Zeck", None), ("guest", "Irene Lyon", "Irene Lyon")]),
    ("the-way-forward-podcast", "Melissa Kupsch: Homeopathy", "2025-04-04", "02:51:59", "https://www.youtube.com/watch?v=GkD0gC1XBO0", [("host", "Alec Zeck", None), ("guest", "Melissa Kupsch", "Melissa Kupsch")]),
    ("the-way-forward-podcast", "Melissa Sell GNM", "2025-11-22", "04:44:40", "https://www.youtube.com/watch?v=1oIIygMsrs0", [("host", "Alec Zeck", None), ("guest", "Dr. Melissa Sell", "Melissa Sell")]),
    ("wonderjunkie-podcast", "Aleen Kanner PRI", "2025-03-06", "01:10:19", "https://www.youtube.com/watch?v=jF722ganOG4", [("host", "Ryan Anderson", None), ("guest", "Aleena Kanner", "Aleena Kanner")]),
    ("wonderjunkie-podcast", "Jacob Liberman- Life is Light", "2025-07-25", "01:44:53", "https://www.youtube.com/watch?v=ReM3lxN7JVc", [("host", "Ryan Anderson", None), ("guest", "Dr. Jacob Israel Liberman", "Jacob Liberman")]),
    ("wonderjunkie-podcast", "Lynne McTaggart- The Power of Intention for Healing", "2025-09-04", "00:50:10", "https://www.youtube.com/watch?v=Af484cWeycg", [("host", "Ryan Anderson", None), ("guest", "Lynne McTaggart", "Lynne McTaggart")]),
    ("wonderjunkie-podcast", "Madhava Setty", "2025-02-19", "01:47:39", "https://www.youtube.com/watch?v=pZx6PrYOF8E", [("host", "Ryan Anderson", None), ("guest", "Dr. Madhava Setty", "Madhava Setty")]),
    ("wonderjunkie-podcast", "Peter Levine- Somatic Experiencing", "2025-02-23", "01:06:44", "https://www.youtube.com/watch?v=WrHCkES_MLA", [("host", "Ryan Anderson", None), ("guest", "Peter A. Levine, Ph.D.", "Peter Levine")]),
]


def stable_id(kind: str, value: str) -> str:
    return str(uuid.uuid5(NAMESPACE, f"{kind}:{value}"))


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", value).strip()


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", normalize(value)).strip("-")


def initials(value: str) -> str:
    parts = [part for part in re.split(r"\s+", value) if part.lower().rstrip(".") not in {"dr", "phd", "nd"}]
    return "".join(part[0].upper() for part in parts[:2])


def duration_seconds(value: str) -> int:
    hours, minutes, seconds = [int(part) for part in value.split(":")]
    return hours * 3600 + minutes * 60 + seconds


def video_id(url: str) -> str:
    return url.split("v=", 1)[1].split("&", 1)[0]


def write_jsonl(name: str, rows: list[dict]) -> None:
    (OUTPUT / name).write_text("".join(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n" for row in rows))


def main() -> int:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    person_id = {canonical: EXISTING_PERSON_IDS.get(canonical, stable_id("person", normalize(canonical))) for _, _, canonical in MANUAL_PEOPLE}
    selected = set(SELECTED_TOPICS)

    new_entities, people_rows, alias_rows, assertion_rows = [], [], [], []
    for position, (domain, original, canonical) in enumerate(MANUAL_PEOPLE, 1):
        entity_id = person_id[canonical]
        published = canonical in selected
        if canonical not in EXISTING_PERSON_IDS:
            new_entities.append({
                "id": entity_id, "kind": "person", "slug": f"person-{slugify(canonical)}", "title": canonical,
                "summary": None, "visibility": "public" if published else "private",
                "lifecycle_state": "active", "editorial_state": "approved" if original in APPROVED_CORRECTIONS else "needs_review",
            })
        if canonical not in EXISTING_PERSON_IDS or published:
            people_rows.append({
                "entity_id": entity_id, "display_name": canonical, "sort_name": None,
                "normalized_name": normalize(canonical), "initials": initials(canonical), "factual_identity": None,
                "identity_review_state": "approved" if published or original in APPROVED_CORRECTIONS else "needs_review",
                "contact_publication_state": "published" if published else "hidden",
            })
        if original != canonical:
            alias_rows.append({
                "id": stable_id("person-alias", f"{entity_id}:{original}"), "person_entity_id": entity_id,
                "value": original, "alias_kind": "spelling_correction" if original in APPROVED_CORRECTIONS else "source_supplied",
                "review_state": "approved" if original in APPROVED_CORRECTIONS else "needs_review",
                "provenance": {"source": "joe_manual_people_list", "source_position": position, "exact_original_preserved": True},
            })
        assertion_rows.append({
            "id": stable_id("editorial-assertion", f"interesting:{entity_id}:joe_burt"),
            "target_entity_id": entity_id, "target_source_id": None, "context_entity_id": None,
            "assertion_type": "interesting", "approval_state": "approved", "context_domain": domain,
            "note": None, "asserted_by": "joe_burt", "endorsement": False, "visibility": "private",
            "provenance": {"source": "joe_manual_people_list", "source_position": position, "meaning": "interesting_to_explore_not_endorsed"},
        })

    relation_rows = []
    for canonical, topic_slugs in SELECTED_TOPICS.items():
        for rank, topic_slug in enumerate(topic_slugs, 1):
            topic_id = TOPICS[topic_slug][0]
            relation_rows.append({
                "id": stable_id("relationship", f"{person_id[canonical]}:associated_with:{topic_id}"),
                "from_entity_id": person_id[canonical], "relationship_type_id": "72aa0428-73e9-5706-8279-8d7088595194",
                "to_entity_id": topic_id, "confidence": 0.9, "rank": rank,
                "context": {"basis": "normalized_from_joe_supplied_domain", "provisional": True},
                "editorial_state": "suggested", "valid_from": None, "valid_to": None,
            })

    show_rows = []
    show_ids = {}
    for show in SHOWS:
        show_id = stable_id("podcast-show", show["slug"])
        show_ids[show["slug"]] = show_id
        show_rows.append({
            "id": show_id, "kind": "podcast_show", "external_id": show["slug"], "canonical_url": None,
            "title": show["title"], "access_state": "available", "slug": show["slug"], "subtitle": None,
            "container_source_id": None, "publication_date": None, "duration_seconds": None,
            "visibility": "public", "editorial_state": "approved", "privacy_state": "public_metadata_only",
            "public_provenance_label": "Saved podcast metadata", "provenance": {"source_system": "kortex_workspace", "body_included": False, "private_locator_included": False},
        })

    episode_rows, credit_rows, public_episodes = [], [], []
    for show_slug, title, date, duration, url, credits in EPISODES:
        external_id = video_id(url)
        episode_id = stable_id("podcast-episode", external_id)
        episode_slug = f"{slugify(title)}-{external_id.lower()}"
        episode_rows.append({
            "id": episode_id, "kind": "podcast_episode", "external_id": external_id, "canonical_url": url,
            "title": title, "access_state": "available", "slug": episode_slug, "subtitle": None,
            "container_source_id": show_ids[show_slug], "publication_date": date,
            "duration_seconds": duration_seconds(duration), "visibility": "public", "editorial_state": "approved",
            "privacy_state": "public_metadata_only", "public_provenance_label": "Metadata recovered from Joe’s saved podcast archive",
            "provenance": {"source_system": "kortex_workspace", "projection": "public_metadata_only", "archive_record_reconciled": True, "body_included": False, "summary_included": False, "private_locator_included": False},
        })
        public_credits = []
        for order, (role, credited_name, canonical_person) in enumerate(credits, 1):
            linked_id = person_id.get(canonical_person) if canonical_person else None
            credit_rows.append({
                "id": stable_id("source-credit", f"{episode_id}:{role}:{credited_name}"), "source_id": episode_id,
                "person_entity_id": linked_id, "role": role, "credited_name": credited_name,
                "credit_order": order, "confidence": 1, "editorial_state": "approved",
                "provenance": {"basis": "explicit_structured_source_metadata", "private_locator_included": False},
            })
            public_credits.append({"role": role, "name": credited_name, "personId": linked_id})
        public_episodes.append({
            "id": episode_id, "slug": episode_slug, "title": title,
            "showTitle": next(show["title"] for show in SHOWS if show["slug"] == show_slug),
            "publicationDate": date, "durationSeconds": duration_seconds(duration), "originalUrl": url,
            "publicProvenanceLabel": "Metadata recovered from Joe’s saved podcast archive", "credits": public_credits,
        })

    books_index = json.loads((ROOT / "data/brain/books-index.v1.json").read_text())
    books_by_author = {}
    for book in books_index["books"]:
        for author in book.get("authors", []):
            books_by_author.setdefault(normalize(author), []).append({
                "id": book["id"], "slug": book["slug"], "title": book["title"],
                "originalAuthor": ", ".join(book.get("authors", [])), "coverPath": book.get("cover", {}).get("public_path"),
            })

    appearances = {}
    for episode in public_episodes:
        for credit in episode["credits"]:
            if credit["personId"]:
                appearances.setdefault(credit["personId"], []).append({
                    "id": episode["id"], "slug": episode["slug"], "title": episode["title"],
                    "showTitle": episode["showTitle"], "role": credit["role"],
                    "publicationDate": episode["publicationDate"], "durationSeconds": episode["durationSeconds"],
                })

    public_contacts = []
    for canonical in SELECTED_TOPICS:
        entity_id = person_id[canonical]
        public_contacts.append({
            "id": entity_id, "slug": f"person-{slugify(canonical)}", "displayName": canonical,
            "sortName": None, "initials": initials(canonical), "factualIdentity": None,
            "curatedInterest": True, "endorsement": False,
            "topics": [{"slug": slug, "label": TOPICS[slug][1], "editorialState": "suggested"} for slug in SELECTED_TOPICS[canonical]],
            "books": books_by_author.get(normalize(canonical), []),
            "podcastAppearances": sorted(appearances.get(entity_id, []), key=lambda row: row["publicationDate"], reverse=True),
        })
    public_contacts.sort(key=lambda row: row["displayName"].split()[-1])

    write_jsonl("new_entities.jsonl", new_entities)
    write_jsonl("people.jsonl", people_rows)
    write_jsonl("person_aliases.jsonl", alias_rows)
    write_jsonl("editorial_assertions.jsonl", assertion_rows)
    write_jsonl("relationships.jsonl", relation_rows)
    write_jsonl("source_shows.jsonl", show_rows)
    write_jsonl("source_episodes.jsonl", episode_rows)
    write_jsonl("source_people.jsonl", credit_rows)

    public_index = {
        "schemaVersion": "brain-people-sources.v1", "generatedFrom": "public-safe Stage 10 metadata projection",
        "contactCount": len(public_contacts), "podcastEpisodeCount": len(public_episodes),
        "contacts": public_contacts, "podcastEpisodes": public_episodes,
    }
    PUBLIC_INDEX.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_INDEX.write_text(json.dumps(public_index, indent=2, ensure_ascii=False) + "\n")
    manifest = {
        "schema_version": "brain-people-sources-import.v1", "manual_people_count": len(MANUAL_PEOPLE),
        "published_contact_count": len(public_contacts), "approved_curated_interest_count": len(assertion_rows),
        "podcast_show_count": len(show_rows), "podcast_episode_count": len(episode_rows),
        "source_credit_count": len(credit_rows), "person_topic_relationship_count": len(relation_rows),
        "high_leverage_assertion_count": 0, "approved_start_here_count": 0,
        "privacy_guards": {
            "private_archive_text_included": False, "private_locators_included": False,
            "personal_journal_material_included": False, "ai_conversations_included": False,
            "podcast_summary_bodies_included": False,
        },
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
