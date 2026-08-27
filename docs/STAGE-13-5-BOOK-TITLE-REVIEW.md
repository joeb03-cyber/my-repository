# Stage 13.5 — Book display-title audit

All 165 imported records were reviewed against the preserved `originalTitle` and existing canonical display title. This pass changes display metadata only. Imported source values, source order, links, documents, and provenance remain intact.

## Applied, high-confidence editorial cleanup

- 38 display-title corrections are encoded explicitly in `lib/brain/books-editorial.ts`.
- Corrections are limited to obvious casing, source-typo cleanup already supported by provenance, and removal of import/export noise.
- `$100M Offers` and `1929` are excluded from public Books while their records and provenance remain in the Brain.
- Public Books are sorted by title while ignoring a leading English `The`, `A`, or `An`; displayed titles are not altered for sorting.

## Editorial review requested

These were deliberately not guessed in this pass:

- **The High-Performance Mind** — current metadata varies between hyphenated and unhyphenated forms.
- **Face to No Face / On Having No Head** — may represent two works or an intentionally combined source document.
- **Collected Essays of Joel Goldsmith** — source and provider wording differ; the cleaned display title is plausible but edition-level verification remains useful.
- **The Book of Love and Creation** — source includes “A Channeled Text”; decide whether that is a subtitle.
- **Matrix Reimprinting Using EFT** — source/provider strings include variant wording and retail noise; edition-level verification remains useful.
- **Sastun** — preserved as the canonical display title, while source provenance contains `Satsun`; verify against the edition read.
- **The Wisdom of Insecurity: A Message for an Age of Anxiety** — existing display includes a subtitle absent from the original source title; retain or shorten editorially.
- **Kundalini, Evolution and Enlightenment** — punctuation/casing corrected, but verify comma style against the preferred edition.

No broad metadata or cover ingestion was performed.
