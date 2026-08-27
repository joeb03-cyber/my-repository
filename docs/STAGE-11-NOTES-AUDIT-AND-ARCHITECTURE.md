# Stage 11 — Notes audit, migration matrix, and publishing architecture

Status: staging vertical slice  
Audit date: 2026-08-27  
Authoritative legacy source: <https://www.synergetichuman.com/>  
Books source: <https://www.synergetichuman.com/notes/books>

## Migration matrix

| Legacy content | Decision | Destination | Stage 11 treatment | Review needed |
|---|---|---|---|---|
| About Me | Migrate / edit / reframe | Notes → About | Published as **About Joe**, closely preserving the source and marking it as a living introduction | Confirm current work, links, and whether Biofield Tuning remains in “Now” |
| What I Believe About Health | Migrate / edit / reframe | Notes → Health | Published as **How I Think About Health Right Now**; physical material retained; speculative claims conservatively framed as working hypotheses | Joe must approve the reframing and decide which metaphysical claims belong publicly |
| Where I’ve Been | Better represented elsewhere | Maps | Not duplicated in Notes | Travel essays and observations can become Notes later; chronology remains Maps-owned |
| Things I Come Back To | Migrate substantially as-is | Notes → Ideas | Published and pinned; Joe-authored reminders preserved; a small attributed quote selection retained | Decide whether to restore the complete quote collection later |
| Biofield Tuning | Migrate / edit / reframe | Notes → Health / future Work With Me | Protected draft only; absent from public views | Approve service language, mechanism framing, credentials, scheduling destination, and any outcomes/testimonials |
| Reading List | Better represented elsewhere | Books | Not migrated | None; Books is authoritative |
| Things I Use + Experimenting With | Migrate / edit / reframe | Notes → Experiments | Published as a dated, non-recommendation snapshot | Confirm what is still current; review medication and psychoactive-substance references |
| The Newsletter | Historical / archive only | Notes → Archive | One published context note and external archive link; no issue ingestion | Decide whether selected issues deserve migration later |
| Credits | Historical / archive only | Provenance / project credits | Attribution retained in this audit, not promoted as a standalone Note | Choose eventual Credits location |

No audited item is permanently discarded in Stage 11. The old Notes implementation itself is a deprecation candidate after migration validation because its anonymous/session-oriented authoring model is not suitable for the new public OS.

## Seed set

Five public notes:

1. About Joe
2. Things I Come Back To
3. How I Think About Health Right Now
4. Things I Use + Experiment With
5. The Newsletter Archive

One private editorial draft:

- Work With Me — Biofield Tuning

The private draft is imported with a private entity and `draft` publication state. The anonymous role cannot select base tables, and the public view requires the entity and note to be explicitly approved and published.

## Content architecture

`note_folders` stores stable, editable folders. `brain_notes` is the canonical note body and publication record. Markdown is the first body format because it is portable and sufficient for long-form writing, lists, links, and images; the format field allows a future structured editor migration. `note_tags` and `note_tag_links` hold lightweight cross-cutting labels. `current_state_snapshots` is the sole canonical current-state source.

Public clients can read only three security-barrier views:

- `brain_public_note_folders`
- `brain_public_notes`
- `brain_public_current_state`

The Notes view excludes drafts, private entities, rejected material, and provenance. The current-state view exposes only the latest explicitly published snapshot. Base tables have RLS enabled with no anonymous write policies. Service-role imports remain staging-only and include project-ref and non-production guards.

## Current-state editorial contract

Supported fields are Where, Reading, Thinking, Rabbit Holes, Experiments, Training, Eating Lately, Listening, Trying to Understand, Making, Current Question, and Human Battery. Unknown values remain `null` or empty. Stage 11 confirms only Sarajevo and “Making Synergetic Human”; it does not invent reading, thoughts, health measurements, or psychological state. Human Battery remains **Unreported** until Joe manually checks in.

## Publishing/editor plan

Stage 11 deliberately does not add anonymous or improvised admin access. The next safe editor increment should be:

1. Supabase Auth with an allowlist for Joe’s email and magic-link or passkey sign-in.
2. An `/editor/notes` route protected server-side as well as by database RLS.
3. Draft autosave to `brain_notes`; preview rendered through the same reader component.
4. Explicit publish/unpublish actions that update publication state and timestamps.
5. Folder, tag, pin, external-link, media, and editorial-notice controls.
6. A small Current State form that writes a new snapshot rather than mutating historical snapshots.
7. Mobile-first editing QA so publishing from a phone does not require code.

No secret belongs in the browser bundle, repository, or chat. Server-only service credentials remain in deployment environment variables.

## Provenance and editorial flags

Every staged Note import keeps source URL, original source title, capture date, and review intent in private provenance. The initial local public index omits private provenance by design. The Work With Me draft additionally flags mechanism, health outcome, remote-equivalence, credentials/training, public contact information, and missing scheduling destination.

Material editorial changes made in the public pilot:

- The health title is explicitly temporal rather than doctrinal.
- Strong metaphysical and health claims are described as interests or working hypotheses, not established facts.
- The experiments note is framed as personal history, not a recommendation.
- Direct email and phone details from the legacy pages are not copied into the public seed.
- The About page is labeled as a living introduction.

These are reviewable staging choices, not final editorial approval.

## Personality surfaces

- Human Battery is a truthful manual-state popover and shows **Unreported** without inventing a percentage.
- Wi-Fi connects to **Consensus Reality** and is explicitly playful.
- Software Update reads from the current-state record and surfaces a small known issue.
- Trash contains sample-safe fictional records and supports local **Put Back** without persistence or destructive deletion.
- Terminal is deferred because Notes quality and mobile behavior are more important than another easter egg in this slice.

## Deferred

Full archive/newsletter ingestion, large People ingestion, Messages, Browser/Rabbit Holes, Time Machine, embeddings, Photos, AI assistant, public Work With Me copy, scheduling integration, and the authenticated editor are intentionally outside Stage 11.
