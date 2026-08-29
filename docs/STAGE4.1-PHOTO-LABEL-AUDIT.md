# Stage 4.1 — Public photo-label audit

Audited against the isolated staging response on 2026-08-29: 217 public photographs, the corrected 113-visit chronology, capture dates, existing GPS-derived locality provenance, and the stored photo-to-Visit relationship state.

## Result

- 203 photographs have a `strong` or `editorial_confident` Visit relationship and now use the canonical Journey/Visit name publicly.
- 124 of those 203 labels visibly change from the raw reverse-geocoded locality to the Journey name.
- 79 already matched their Journey name.
- 14 remain reviewable: 11 unresolved and 3 moderate. Their raw public locality is retained where one exists; no canonical Visit is guessed.
- Raw reverse-geocoded names and private GPS provenance are not rewritten.

Confirmed examples include Lambeth → London, Dapa → Siargao, Buda → Budapest, and Ipanema → Rio de Janeiro.

## Review list

| Capture date | Current locality | Country | Existing possible Visit | State |
| --- | --- | --- | --- | --- |
| 2024-12-03 | Phi Phi Don | Thailand | — | unresolved (2 photos) |
| 2025-01-18 | Ban Mai Khao | Thailand | Phuket | moderate |
| 2025-02-28 | Hạ Long | Vietnam | — | unresolved |
| 2025-03-19 | Quận Ba | Vietnam | — | unresolved |
| 2025-12-10 | — | — | — | unresolved |
| 2025-12-16 | San Marcos La Laguna | Guatemala | Antigua Guatemala | moderate (2 photos) |
| 2026-03-23 | Miami Beach | United States | — | unresolved |
| 2026-07-15 | — | — | — | unresolved |
| 2026-08-26 | Hreša | Bosnia and Herzegovina | — | unresolved |
| Undated | — | — | — | unresolved (3 photos) |

The public normalization occurs at the lived-history read boundary. This keeps user-facing labels consistent in Photos, Maps, the shared viewer, and wallpaper captions while leaving source provenance intact.
