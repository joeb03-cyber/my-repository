# Books / Brain Stage 3 validation

Generated: 2026-08-27
Status: local vertical slice complete; no deployment and no Supabase write performed.

## Result

The repository now contains a deterministic, versioned Books corpus; a normalized Brain schema and guarded importer; public Library read models and routes; and a development-only editorial interface. The live legacy site, legacy Notes data, Google Docs, and production Supabase project were not modified.

## Corpus totals

| Measure | Result |
| --- | ---: |
| Books | 165 |
| Books with linked Google Docs | 163 |
| Accessible exported Docs | 157 |
| Viewer-access-required Docs | 6 |
| Books without Docs | 2 |
| Parsed source units | 19,706 |
| Public reader units, including structure | 16,921 |
| Readable passages | 15,431 |
| Chapter labels | 822 |
| Section labels | 668 |
| Possible personal summaries | 3, all private pending review |
| Manual standouts in the generated snapshot | 0 |

Google Doc coverage is 95.2% of the complete bookshelf, or 96.3% of books that contain a Doc link.

## Metadata and covers

| State | Books | Rate |
| --- | ---: | ---: |
| Catalog matched | 112 | 67.9% |
| High-confidence partial metadata | 7 | 4.2% |
| Source-only metadata | 46 | 27.9% |
| Real, locally cached covers | 96 | 58.2% |
| Deliberate local placeholders | 69 | 41.8% |

Metadata candidates retain provider provenance and match scores. Covers were sourced from accepted public metadata providers and cached locally; Amazon images were not scraped. The original retail URLs remain separate provenance, including both malformed `hhttps` source links (All for Love and The Denial of Death). All for Love is represented as Matt Kahn's book. Face to No Face / On Having No Head is one book identity with the full original source title preserved.

## Suggested topic taxonomy

The global taxonomy contains 13 editable, unapproved topics:

1. Consciousness & Nonduality (64)
2. Spirituality & Mysticism (50)
3. Meditation & Practice (25)
4. Psychology & Inner Work (24)
5. Trauma & the Nervous System (11)
6. Health, Biology & Longevity (32)
7. Energy & Esoteric Healing (12)
8. Love & Relationships (54)
9. Creativity, Purpose & Work (17)
10. Money, Business & Achievement (38)
11. Philosophy, Reality & Meaning (102)
12. Travel, Pilgrimage & Freedom (5)
13. Society, Culture & Systems (28)

The taxonomy is useful as a first navigation layer, but Philosophy, Reality & Meaning is too broad to approve unchanged. All topic assignments remain suggestions in both the data and editorial UI.

## Review flags

- 2,495 short, unstyled fragments remain `unknown` and reviewable; they were not silently coerced into highlights or headings.
- 434 conservatively detected section labels are flagged for review.
- 16 summaries and 2 note-like blocks are reviewable but treated as book-derived content.
- 3 blocks are `possible_personal_summary`; they are excluded from public reader models and the public API until explicitly approved.
- 8 books have incomplete source states: six viewer-only Docs and two without Docs.
- 69 books deliberately use the neutral placeholder because no cover match met the confidence threshold.

No parser unit was discarded: every one of the 19,706 units has a source fragment, deterministic paragraph/body-block range, normalized highlight record, and provenance link. Public display eligibility is a separate editorial decision from preservation.

## Architecture delivered

- `brain_books_v1` migration: entity core plus books, people, media, topics, typed relationships, sources, immutable source versions/fragments, highlights, provenance, ingestion runs, and ingestion issues.
- Deterministic UUIDv5 identities and unique constraints make the snapshot and later import idempotent.
- A guarded importer refuses to run unless explicitly configured for a development environment and rejects production-looking targets.
- Generated JSONL import tables are separated from generated public read models so the UI does not depend on database table shapes.
- Public APIs strip review data. Development review requests expose uncertainty and provenance only locally.
- Editorial decisions are saved to local browser storage and can be exported as versioned JSON. No decision is written to Supabase.
- Standouts support zero to three manually selected passages. No automated standout suggestions are generated.

## Validation performed

- Clean regeneration produced a byte-identical import manifest and identical hashes for all 15 JSONL tables.
- Validated unique identifiers, table row counts, foreign keys, source ranges, cover hashes, reader-to-highlight traceability, and 19,706 provenance links.
- Confirmed all 96 referenced cover files exist and match their recorded SHA-256 hashes.
- Confirmed the three possible personal summaries do not occur in reader models or the public API.
- Confirmed a manual standout appears in the public reader after local approval and disappears when unstarred; the generated baseline remains at zero.
- Browser-tested title/author/topic search, the five-book Travel filter, a short seven-unit document, a long structured document, a viewer-only source state, and a no-Doc state.
- Long editorial sets render in batches of 80 while retaining access to every unit.
- TypeScript passes with no errors.
- The Next.js production build passes. One non-blocking lint warning remains for using a plain `<img>` for local cover assets.

## Local review

Run:

```bash
npm run dev -- -H 127.0.0.1 -p 3100
```

Open `http://127.0.0.1:3100/library`. In development, use **Review** to inspect metadata, covers, topics, incomplete sources, parser uncertainty, suspected summaries, and manual standout selection. **Export decisions** downloads the current local editorial state as versioned JSON.

The legacy Notes routes still require their existing Supabase public environment variables for live data. Their static-path generation now safely tolerates an unavailable backend during local builds.

## Decisions needed before a staging import

1. Grant viewer/public-read access to the six unresolved Google Docs, or accept those books as intentionally incomplete.
2. Decide whether to split or narrow Philosophy, Reality & Meaning before approving the taxonomy.
3. Review the three possible personal summaries; none is currently publishable.
4. Decide whether the 69 placeholders are acceptable for the first staging release or whether cover research should continue first.
5. Decide whether the 46 source-only and 7 partial metadata records can enter staging as reviewable records.
6. Provide or approve a dedicated non-production Supabase project before any migration/import is run.

None of these decisions blocks continued local editorial review. They should block production import or publication of unresolved records, not the architecture itself.
