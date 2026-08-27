# Places, trips, and photos staging notes

## Source and interpretation

The authoritative snapshot is `data/brain/travel/source/what.2026-08-27.md`, captured non-destructively from the public `/notes/what` page. The generated inventory retains all 101 source bullets in their exact reverse-chronological order and expands only two explicit grouped records: the ten-stop Italy line and `el bolson + lago puelo`.

The public source supports 110 place visits/stays and one explicit movement (`left austin`). It does not say whether most records were day visits, short stays, or longer stays, so the normalized records use `visit_or_stay_unspecified`. It supplies month or month-range precision only; no day values are manufactured. The `dec-feb` Buenos Aires record correctly crosses from December 2023 to February 2024.

Country assignments and coordinates are candidates, not source truth. Country context is derived from the route. Coordinates were resolved offline against GeoNames `cities500` (CC BY 4.0), so the itinerary itself was not sent to a geocoder. Ninety of 103 unique labels have candidate locality centroids. Thirteen labels remain unresolved because they are islands, regions, a lake, or small/variant localities; they remain visible in the chronology and are not given invented coordinates.

Review decisions still needed:

- Does `st. petersburg` mean St. Petersburg, Florida?
- Does `isabela` mean Isabela, Puerto Rico?
- Confirm route-context choices for Antigua (Guatemala), La Libertad (El Salvador), and Santiago (Chile).
- Resolve/correct the 13 labels listed in `travel-timeline.v1.json` when richer geodata or editorial input is available.
- The page's latest record is Warsaw in August 2026, while the frozen OS shell says Sarajevo. The import explicitly preserves this conflict and does not overwrite the current-location widget.

## Brain model

The staging migration separates reusable places from temporal visits/stays and source-backed movements. Base tables are protected by RLS. Anonymous readers receive only safe `brain_public_*` views. Photo exact GPS and original source paths live in a separate protected table and are structurally absent from the public Photos view.

## Photo inventory

The expected source folder is `~/Pictures/Synergetic Human Photos/Originals`. It was not present during this stage, so no photo files were inspected and no substitute imagery was added.

Run `python3 scripts/ingestion/inventory-travel-photos.py --check` after the folder is available. A full run reads supported files recursively, hashes them, extracts a conservative metadata allowlist, and writes local review artifacts under the gitignored `artifacts/photo-inventory/`. It never writes to the source tree. Exact GPS remains only in the private inventory; every place/visit association and every Photos/favorite/wallpaper flag defaults to unreviewed/false.
