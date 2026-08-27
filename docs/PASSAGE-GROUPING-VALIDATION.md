# Books passage grouping validation

Generated: 2026-08-27
Status: local presentation layer only; source units are unchanged.

## Result

The reader now groups adjacent source units into visual passages while preserving every original content unit, deterministic source key, source order, and paragraph range. Grouping changes display boundaries only: it never rewrites text or merges database highlight records.

| Measure | Result |
| --- | ---: |
| Public reader units | 16,921 |
| Display groups, including 1,490 structural labels | 12,000 |
| Normalized content-passage groups | 10,510 |
| Multi-unit groups | 1,788 |
| Source units participating in multi-unit groups | 6,709 |
| Visual joins replacing row-level dividers | 4,921 |
| Multi-unit prose groups | 1,557 |
| Multi-unit list/exercise groups | 229 |
| Introductory prose + list groups | 2 |

Most multi-unit groups contain two to four units. Structural labels remain separate. A blank source paragraph, a structural transition, a formatting change, or insufficient evidence starts a new passage.

## Representative tests

| Source | Reader units | Display groups | Multi-unit groups | What it tests |
| --- | ---: | ---: | ---: | --- |
| How to Heal Your Metabolism | 138 | 36 | 34 | recipe/checklist-like sequences and short prose runs |
| The Artist's Way | 387 | 121 | 40 | exercises, lists, semantic headings, and prose |
| The Energy Codes | 332 | 161 | 70 | long structured source with instructions and prose |
| Reality Creation Technique | 1,264 | 1,218 | 23 | many independent highlights; only strongly adjacent runs join |
| Vagabonding | 7 | 6 | 1 | short document where nearly all highlights remain independent |

The editorial console exposes a join/separate control between adjacent units. Manual choices are stored as local, exportable editorial decisions and are applied only to the visual grouping. The generated baseline remains deterministic.

## Rules and limitations

- Adjacent list or exercise units with uninterrupted source structure may group.
- Introductory prose ending in a colon or dash may group with its immediately following list.
- Matching, uninterrupted prose may group conservatively in short runs, capped at four units.
- Chapter and section labels never merge into prose.
- Ambiguous boundaries stay separate by default.
- Source ranges and content-unit identifiers remain individually inspectable after grouping.

The main review risk is that some documents use identical formatting for a conceptual sequence and for unrelated consecutive excerpts. Those cases are intentionally reversible in the review interface rather than being destructively normalized.
