# Synergetic Human: Product Architecture and Roadmap

Status: living product architecture; Books, Places, People/Sources, Notes/current state, and the private Control Center are implemented in isolated staging.
Last updated: 2026-08-28.

## Product premise

**Synergetic Human is a human life rendered as an operating system.**

The desktop represents the present moment. Applications are familiar interfaces into a shared archive of books, people, places, media, writing, experiments, beliefs, and sources. The site should remain sincere and useful, with occasional restrained humor.

The technical product has two layers:

- **The OS:** desktop, windows, Dock, application chrome, menus, routes, Spotlight, and responsive interaction.
- **The Brain:** structured entities, source material, relationships, media, provenance, temporal state, search, and ingestion workflows.

Applications are views into the Brain. They must not become separate content silos.

The public experience has three product roles: **Utility** (Books, Notes, Maps, Photos, Contacts), **Exploration** (future Browser/Rabbit Holes, Finder, Human, Spotlight, and Brain relationships), and **Personality** (Trash, Software Update, Activity Monitor, Screen Time, Terminal, Settings, Battery, Wi-Fi, and small system messages). Utility remains familiar and useful; personality stays sparse, handcrafted, and manually editable where it represents Joe.

## Current implementation assessment

The product is a Next.js 14 App Router application. Its OS is a client-side shell containing the window manager, Dock, menu system, wallpaper state, mobile shell, and canonical application routes. Books, travel, Contacts, public Notes/current state, Software Update, Trash, and Activity Monitor now read purpose-specific public models from an isolated Supabase Brain, with validated local snapshots as fallback where appropriate.

The private `/control` surface uses Supabase Auth, a one-person administrator allowlist, protected routes/commands, and narrow RLS policies. Production remains separate. The legacy Notes product remains reference material rather than the target architecture.

### Reasonable to preserve

- Window state, focus, dragging, resizing, minimizing, reopening, and layering.
- Desktop/Dock/menu interaction model and intentional mobile shell.
- Canonical top-level application routes.
- Typed UI props and current component boundaries as a prototype foundation.
- Existing Supabase client utilities, after security and version review.

### Must evolve before substantial real data

- `PrototypeShell` is both OS controller and application launcher; it should gradually delegate to an application registry and focused window/state hooks.
- `AppContent` is a hard-coded application switch and will become unwieldy.
- `PrototypeBook` mixes domain data, presentation data, relationships, and sample content in one frontend file.
- Every application currently receives data directly rather than through a server-side domain/query boundary.
- Book details do not yet have their own canonical URL.
- `os.css` is intentionally prototype-scale and monolithic; it can wait until product behavior stabilizes.
- The legacy Notes schema is specialized around editable Markdown notes and is not a suitable knowledge-graph foundation.

## Target architecture

```text
OS presentation
  desktop / windows / applications / routes
                 ↓
Application queries and commands
  books view / finder view / spotlight view / maps view
                 ↓
Domain layer
  entities / relationships / provenance / temporal state / media
                 ↓
Supabase Brain
  Postgres / Storage / full-text search / controlled ingestion
```

Application components should depend on typed query results, not Supabase table shapes. Server-side query modules should assemble purpose-specific read models such as `BookDetail`, `PersonProfile`, or `SpotlightResult`. This keeps the UI replaceable and prevents one application's needs from distorting the shared data model.

## Proposed future Supabase model

Use PostgreSQL as a relational knowledge graph: normalized domain tables for important entity types plus a generic relationship table for cross-domain connections. A separate graph database is not justified now.

### Shared core

| Table | Purpose |
| --- | --- |
| `entities` | Stable identity shared by books, people, places, notes, highlights, episodes, articles, photos, experiments, topics, and other future types. Suggested fields: `id`, `kind`, `slug`, `title`, `summary`, `visibility`, `status`, timestamps. |
| `relationship_types` | Controlled vocabulary such as `authored_by`, `about_topic`, `related_to`, `mentions`, `occurred_at`, `features_person`, `source_for`, or `wallpaper_candidate`. |
| `relationships` | Directed edges: `from_entity_id`, `relationship_type_id`, `to_entity_id`, optional context, rank/order, confidence, validity dates, and provenance reference. |
| `topics` | First-class topic details keyed to an entity. Topics replace free-floating category strings when meaning and relationships matter. |
| `entity_dates` | Optional named dates or ranges such as read, visited, published, observed, started, or ended, without forcing every domain into one pair of date columns. |

Important entity types should also have typed detail tables keyed one-to-one to `entities.id`, for example `books`, `people`, `places`, `notes`, `podcast_series`, `podcast_episodes`, `articles`, `photos`, and `experiments`. Use JSONB only for genuinely irregular source-specific metadata—not as a substitute for relationships or core fields.

### Books and highlights

| Table | Purpose |
| --- | --- |
| `books` | Subtitle, ISBNs, publisher, publication date, edition/language, cover asset, reading state, personal note, and external identifiers. Author connections live in `relationships`. |
| `highlights` | A first-class entity/detail record with `book_id`, exact text, original order, page/location when known, standout flag/rank, annotation, and source fragment. |
| `external_links` | Typed links for book information, source documents, interviews, purchase/reference pages, and future entity types. |

Highlights should preserve source order. “Three standout highlights” is presentation metadata on highlights, not duplicated text fields on a book.

### Provenance and ingestion

| Table | Purpose |
| --- | --- |
| `sources` | Origin such as Google Doc, existing site page, podcast transcript, article URL, manual entry, or import file. |
| `source_versions` | Immutable snapshots/hashes and import timestamps so changes can be audited or reprocessed. |
| `source_fragments` | Addressable passages/sections with source locator, order, raw text, and optional normalized text. |
| `provenance_links` | Connect an entity, highlight, relationship, or later claim to the source fragment supporting it. |
| `ingestion_runs` / `ingestion_issues` | Track parser version, status, counts, warnings, duplicates, and human decisions. |

The import process should be idempotent: a stable source identifier plus source hash should prevent duplicate records and make re-import safe. Imported raw material should remain recoverable even after normalization.

Messages will eventually require stronger claim-level grounding. Before building it, add a claim/citation layer over `source_fragments`; do not generate simulated positions directly from unsourced person biographies or generic model knowledge.

### Media and time

- `media_assets` should represent stored files and metadata once. `photos` can reference an asset; Maps, Notes, wallpaper, and Time Machine then reference the photo entity rather than copying file records.
- `current_states` should store time-bounded states such as current location, reading, thought, experiment, or desktop wallpaper selection with `valid_from` and `valid_to`.
- Important records should support `occurred_at` or named ranges from the beginning. Do not build Time Machine snapshots yet; retain enough temporal truth to derive them later.

### Search and access

- Begin with PostgreSQL full-text search over a derived `search_documents` read model spanning entity titles, summaries, highlights, and source text.
- Add embeddings/vector search only when semantic retrieval has a defined evaluation set. Spotlight does not require vectors for its first version.
- Public applications should read only published/public rows through RLS-protected views or server queries.
- Owner/editor writes and ingestion should run through authenticated server-side commands. A Supabase service-role credential must never reach the browser.

## Decisions to make now

1. Establish stable UUID identity, canonical slugs, entity kinds, visibility, and lifecycle states.
2. Treat topics, people, places, media, sources, and highlights as reusable records rather than strings embedded in application content.
3. Require provenance for imported material and preserve raw source snapshots.
4. Preserve temporal fields and ranges even though Time Machine is deferred.
5. Introduce typed server-side domain queries between applications and Supabase.
6. Define canonical detail routes, beginning with `/library/[book-slug]`, while retaining window behavior.
7. Use an application registry for Dock metadata, route, icon, window defaults, and component loading.
8. Build imports as staged, repeatable jobs with validation and human approval—not scripts that write directly from unreviewed AI output.
9. Keep public/private visibility explicit at the entity and source level.
10. Make Books the first vertical slice proving ingestion, provenance, relationships, search, and application rendering.

## Decisions that can wait

- Final schema for Messages, group conversations, and model/provider choice.
- Embeddings, vector database extensions, and Ask mode.
- Time Machine reconstruction and snapshot UX.
- Map provider, route animation, and geocoding pipeline.
- Full authoring CMS versus a lightweight owner console.
- Realtime collaboration, public accounts, comments, or social features.
- Booking, trading integrations, laboratory data, and health-device imports.
- Whether large graph visualizations need specialized infrastructure; PostgreSQL edges are sufficient initially.

## Staged implementation roadmap

### 0. Architecture contract — now

Keep this document as the boundary. Do not add placeholder applications merely because they appear in the long-term vision.

### 1. Books ingestion discovery — first real-data milestone

Inventory the existing book records and Google Docs, sample document formats, define the normalized book/highlight contract, and produce a local staged import plus validation report. No production database writes.

### 2. Brain foundation

After review, create versioned Supabase migrations for the minimal shared core: entities, books, people, topics, highlights, relationships, sources, provenance, external links, ingestion runs, and public read policies. Use a separate development/staging environment before production.

### 3. Real Library vertical slice

Import a representative batch, render list/search/filter/detail views from server-side read models, add canonical book URLs, preserve window behavior, and verify source links and standout-highlight ordering. Then import the remaining books.

### 4. Finder and Spotlight foundation

Expose the same records through a straightforward Finder hierarchy and cross-entity lexical search. This validates that the Brain is not Library-specific.

### 5. People, topics, podcasts, articles, and notes

Import one domain at a time, reuse shared people/topics/sources, and add application views only after the underlying entities can appear across Finder and Spotlight.

### 6. Places, photos, Maps, and current state

Build the shared media/place/time model, select real wallpapers from the photo archive, and connect trips, photos, notes, reading, and desktop state.

### 7. Human/Health, Practice, Trading, Settings, and Trash

Add only when source material, privacy rules, and maintenance workflows are clear.

### 8. Grounded Messages and Ask mode

Proceed only after source fragments, citations, retrieval evaluation, limitations, and clear “SIMULATED · GROUNDED IN PUBLISHED WORK” labeling are proven.

### 9. Time Machine

Derive historical states from accumulated temporal data; do not make it an MVP dependency.

## Books milestone: required inputs

The current checkout contains only the ten mock records in `data/prototype.ts`. A repository-wide search found no production bookshelf inventory or Google Docs links, so the authoritative existing-site source still needs to be located or supplied.

### From the existing site/repository

- The authoritative source of the current book list and the exact code/data path that renders it.
- For every book: current title, author, subtitle if present, categories/tags, cover source, external links, Google Doc URL, and any reading status or personal note.
- Existing slugs/URLs that should be preserved or redirected.
- Any hidden/manual book data not committed to the repository.
- Rules currently used to choose covers, ordering, featured books, and categories.

### From Google Docs

- Access to the linked documents through shared read links, Google Drive/Docs API authorization, or exported `.docx`/HTML files supplied in a selected folder.
- Five to ten representative documents, including the messiest examples, before designing the parser.
- Confirmation of heading/highlight conventions: title blocks, quotation formatting, page/location markers, personal annotations, and separators.
- A decision on whether highlighted text is always from the book and whether personal notes must be distinguishable.
- Permission/visibility rules for source documents and imported excerpts.

### Decisions from Joe

- How to handle duplicate editions, missing ISBNs, and books without highlight documents.
- Preferred metadata/cover authority when existing data is incomplete.
- Whether current categories should be preserved exactly or normalized with suggested topics.
- Whether standout highlights are explicitly marked, selected manually, or suggested for approval.
- Which fields or books must remain private.

## Recommended Books import workflow

1. Extract the existing book inventory and source links.
2. Export representative Docs without altering the originals.
3. Parse into a versioned local intermediate format containing raw source locators and normalized candidates.
4. Match/deduplicate books using existing slug, document ID, ISBN, and normalized title/author.
5. Enrich missing metadata and covers from an agreed authority while retaining source attribution.
6. Suggest topics, relationships, and standout highlights; require human approval for uncertain matches and editorial choices.
7. Produce a validation report: missing docs, inaccessible links, duplicates, parse failures, counts, and sample render records.
8. Only after approval, create the development schema and perform an idempotent staged import.

Success means adding or re-importing a book does not require editing frontend code, imported text can be traced to its source, and the same book/person/topic records are immediately reusable by Library, Finder, Spotlight, Contacts, Messages, and future applications.

## Documented future product concepts

These directions are deliberately recorded but not part of Stage 13 implementation.

### Expanded Maps — Joe’s subjective layer over Earth

Maps should retain familiar geographic interaction—real tiles, pan/zoom, native-feeling pins, subtle routes, place cards, and mobile drawers—while the content answers “What was Joe’s Budapest?” rather than “What is Budapest?” A Place may eventually connect stays, neighborhood/accommodation, routine, food, specific places, memorable **Characters**, moments, photos, reading/learning, life context, “Would I live here?”, and Joe’s verdict. Provider selection and a deeper Maps rebuild remain deferred.

### Photos — familiar, visual, and content-first

Photos should wait for the real archive and shared media model. Candidate albums include People I Met Once, Things I Ate, Sunsets, Gyms Around the World, Apartments I’ve Temporarily Called Home, Photos I Took Because the Light Was Nice, and No Idea Why I Took This. Albums are editorial groupings over reusable photo records, not copied files.

### Browser / Rabbit Holes — The Internet According to Joe

Browser is not a fake general-purpose browser. A Rabbit Hole is an interesting question plus the highest-signal material Joe has encountered around it, connected across People, Books, Podcasts, Papers, Articles, Videos, Notes, and Experiments. A current take may simply be “I don’t know. This is fascinating.” Build only after the related sources and editorial workflow exist; no chatbot or autonomous browsing is implied.

### Reminders — Things I Don’t Want to Forget

The future Reminders concept is a small, personal memory surface rather than a conventional task manager. It should distinguish durable reminders from time-bound tasks and connect to public-safe Notes, Places, People, and ideas where useful. No application, schema, or ingestion is authorized yet.
