# Books / Brain Stage 4 report

Generated: 2026-08-27
Status: local implementation complete; no Supabase write and no deployment performed.

## What changed

- Added reversible, presentation-only passage grouping and adjacent-unit join/separate controls in the local editorial console.
- Reworked all eight dock icons as original Lucide-based, code-native system icons with modern full-bleed squircle materials, per-app color identities, restrained depth, and the existing magnification/running/tooltip behavior intact.
- Ran a systematic cached cover-recovery pilot over all 69 prior placeholders. Seven high-confidence real covers were accepted, increasing coverage from 96 to 103 of 165 books (58.2% to 62.4%).
- Audited the complete current 13-topic taxonomy and proposed a v2 structure without applying it.
- Added an optional server-side Supabase read adapter and public API hydration. Local JSON remains the default and deliberate fallback.
- Extended the unapplied development migration with normalized passage groups and narrow public read views.

## Cover recovery

Recovered: Atmamun; Learning to Love Yourself; Life Force; No Bad Parts; Spirit Tech; The Divine Romance; and The Wisdom of Insecurity. All seven are locally cached and traceable to Open Library records; no Amazon image was scraped.

The remaining 62 placeholders are classified as follows:

| Reason | Books |
| --- | ---: |
| Rate-limit/provider-access artifact | 23 |
| Unusual or independent publication | 17 |
| Confident identity, no usable provider cover | 13 |
| Edition or identity ambiguity | 4 |
| Apparently unavailable cover | 4 |
| Source-title normalization problem | 1 |

Provider responses, candidates, errors, accepted identities, image hashes, and reason classifications are retained in `data/ingestion/bookshelf/corpus-v1/cover-recovery-report.v1.json`. The recovery script supports a quota-bearing Google Books key from the process environment, but none is stored in the repository. Google Books returned HTTP 429 during this pass, so unresolved rate-limited records were not guessed or hammered with retries.

## Staging architecture

A separate Supabase project is recommended. The existing project contains the legacy Notes product and source/reference data; isolation makes migrations, resets, row-level-security checks, and import rehearsals safer. The additive schema could technically coexist, but there is no operational benefit worth coupling the first Brain import to production.

The application now supports:

- default: deterministic local JSON read models;
- optional: `BRAIN_DATA_SOURCE=supabase` plus dedicated `BRAIN_SUPABASE_URL` and `BRAIN_SUPABASE_ANON_KEY` server-only environment variables;
- public UI/API access only through limited public views;
- importer access only through a server-side service-role key, exact project-ref match, explicit non-production acknowledgement, and environment guard.

No staging credentials, project reference, CLI linkage, or hosting project configuration were present in the workspace. Therefore no migration, import, or preview deployment was attempted.

## Validation

- 165 books; 157 accessible source Docs; 8 incomplete records preserved.
- 19,706 source/highlight units and 19,706 provenance links verified.
- 16,921 public reader units represented exactly once and in order in 12,000 display groups: 10,510 content-passage groups plus 1,490 standalone structural labels.
- 103 real local cover files exist and match their recorded hashes; 62 placeholders remain explicit.
- Three possible personal summaries remain excluded from public read models.
- No standout was auto-generated.
- The six restricted Docs remain intact as incomplete records.
- TypeScript passes and the optimized Next.js production build completes. The only build warning is the existing deliberate plain `<img>` used for locally cached cover files.

See `PASSAGE-GROUPING-VALIDATION.md` and `BOOKS-TAXONOMY-REVIEW.md` for the detailed reviews.
