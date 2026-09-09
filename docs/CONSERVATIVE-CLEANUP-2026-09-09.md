# Conservative cleanup — 9 September 2026

Local changes only. No deployment, live database writes, data-file edits, schema migrations, or stored-message rewrites were performed. Existing unrelated ingestion artifacts were left alone.

## Fixed

- Browser links select the named Human entry or Contact, and Notes links use the real Notes route. Human relationships now distinguish books, people, and notes. Human links to unpublished Browser destinations are hidden; unpublished connected tabs cannot be clicked.
- Browser retains its open trail when another app becomes active. Query-only navigation brings the destination app forward even when its window already exists. Home resets the desktop; closing an app uses its actual route mapping.
- Exact selection is represented within existing routes: `/contacts?person=…`, `/journal?note=…`, `/laboratory?entry=…`, and `/messages?conversation=…`. Selections respond to incoming URLs and unavailable items get recovery controls. Books retain their existing `/library/<slug>` URLs, now used consistently on mobile.
- Photos → Show on Map closes the photo overlay before handing off the selected visit. Maps reapplies that handoff when its map finishes loading. Phone search/year results are visible and scrollable; choosing a result collapses the list. No-results feedback and photo button labels were added.
- Mobile Reading handles both current multi-book and older single-book records. Its empty-state Books button works. Book back navigation clears the detail URL.
- Finder's fixed counts became descriptive labels; its location links work. Dead Finder controls and future-app inventory were removed. Dead controls in Notes, Contacts, Browser, Activity Monitor, Terminal, Trash, and Reality were removed, as were decorative Settings chevrons and advertised keyboard shortcuts without handlers. Empty Settings lenses are hidden.
- Removed public migration/archive-reconciliation/internal metadata copy, the misleading iCloud label, false Software Update freshness copy, book import-position numbers, and the claim that all highlights are complete. Books distinguish loading from failure. Software Update/Activity/Trash no longer initially flash the old bundled OS snapshot.
- Public Trash's playful Put Back action is explicitly visit-only and never calls the admin mutation endpoint.

## Messages

- Control Center has a permanent delete action with a named-conversation confirmation, busy state, and error handling. The authenticated endpoint validates confirmation and UUID, deletes only that conversation ID, and checks the result. Existing database cascades remove its messages and citation rows. Shared people and other conversations are untouched by this operation.
- Preserved existing paragraph-spacing CSS and long-draft presentation behavior. Normalized LF/CRLF/bare-CR line breaks in the renderer; explicit paragraphs remain separate paragraphs and individual line breaks use `white-space: pre-line`. No stored replies were edited.
- Empty published results stay empty. Failed live reads show an error instead of bundled old drafts. The public API and fetch avoid caching stale conversations. Switching threads resets scroll, and replies without citations omit the empty source footer.
- Local `/library/…` citations now survive editor saves. Filtering invalid source URLs no longer shifts the source kinds onto different surviving links. Unsafe protocols and protocol-relative destinations remain rejected.

## Outstanding audit areas

- Small type and dense secondary information outside the touched Maps controls remain; this was not a global typography pass.
- Photos/visits and individual passages do not gain a new universal share-link system. App-level query links are intentionally a limited improvement; per-item social previews and durable aliases after slug changes are not implemented.
- Human's editorial overrides and the mixture of bundled and database-owned content remain. This pass removes specific stale flashes and Messages fallbacks, not every fallback throughout the project.
- Content depth, freshness, unevenness, and redundant ways of presenting the same personal snapshot still need editorial judgment. Unpublished Browser trails remain unpublished; empty Settings lenses were hidden rather than filled.
- Existing Messages saving still consists of multiple database operations. This pass does not make the whole save operation transactional; permanent deletion itself uses one parent delete with database cascades.

## Intentionally deferred

First-visit/landing redesign; Notes editorial choices; authored trails and meaningful connections; Time Machine; graph/knowledge UI; major Human or Browser expansion; Contacts content expansion; Podcast app; broad routing, content-ownership, and database rewrites. Playful functioning elements such as Innernet, the Activity Monitor joke, and Terminal commands remain.

## Verification and pre-production checks

- Nine automated regression tests cover deletion authorization, confirmation, ID scope, missing/error responses, schema cascade contracts, empty/error Messages reads, paragraph preservation, and citation saving. These use a mocked database, never live deletes.
- TypeScript, lint, and the optimized Next.js production build pass. Existing image-optimization and outdated Browserslist-data warnings remain.
- Local browser walkthrough verified Browser → exact Human/Contact, the return trail, Photos → Riga with its viewer dismissed, phone Maps search → Tokyo, mobile Messages selection/reading/back navigation, a fresh conversation URL, and phone Reading → exact book → Books.
- Browser testing used local snapshot content, not the production database. The map selection and visit drawer worked, but base tiles appeared blank in the automated phone capture; verify actual map rendering on a physical phone with normal network access.
- Before release, use disposable staging conversations to test cancel/delete, shared-person isolation, dependent message/citation cleanup, expired authentication, and deleting the last published conversation. Verify fresh public reads and unavailable shared links afterward. No live deletion was exercised here.
- Check direct item URLs, refresh and browser Back/Forward, already-open windows, and mobile Books/Notes/Messages back buttons. Recheck Maps with the phone keyboard open and both fresh/already-open Maps windows.
- Save/reopen a disposable reply containing multiple paragraphs, single line breaks, local book citations, external citations, and no citations. Confirm text and source types survive. Deployment remains a separate step.
