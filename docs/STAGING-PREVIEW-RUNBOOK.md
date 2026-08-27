# Staging Brain and preview runbook

This runbook intentionally targets new, isolated non-production projects. It must not be pointed at the legacy production Supabase or hosting project.

## 1. Create isolated targets

1. Create a new Supabase project named clearly as development/staging.
2. Create a separate preview hosting project; do not link or alias `synergetichuman.com`.
3. Store credentials only in local shell/hosting secret settings. Do not add values to repository files.

## 2. Apply only Brain SQL

Apply these exact files, in order:

1. `supabase/migrations/20260826220000_brain_books_v1.sql`
2. `supabase/migrations/20260827100000_brain_passage_groups_v1.sql`
3. `supabase/migrations/20260827120000_brain_document_title_kind.sql`
4. `supabase/migrations/20260827130000_brain_public_book_counts.sql`

Do not run an unrestricted migration-directory push: the directory also contains the legacy 2024 Notes migration. Verify that the public views exist and that the base Brain tables cannot be selected with the anonymous role.

## 3. Import the snapshot

Run `scripts/ingestion/import-brain-snapshot.mjs data/brain/import-v1` from a shell containing:

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`;
- `BRAIN_IMPORT_ENVIRONMENT=staging`;
- `BRAIN_IMPORT_PROJECT_REF` exactly matching the target URL;
- `BRAIN_IMPORT_ACKNOWLEDGE_NON_PRODUCTION=yes`.

The service-role key is import-only and must never be exposed to the browser or preview client. Run the import twice and confirm the second pass changes no row counts. Then compare database counts with `data/brain/import-manifest.v1.json`.

## 4. Validate privacy and reads

- Anonymous access succeeds only through `brain_public_*` views.
- Anonymous base-table selects fail under row-level security.
- The three `possible_personal_summary` records do not appear in `brain_public_highlights`.
- The six restricted-Doc and two no-Doc books exist as incomplete records.
- No generated record has a standout rank.
- Public passage-group membership reproduces source order exactly.

## 5. Connect the preview

Set these server-side preview variables:

- `BRAIN_DATA_SOURCE=supabase`
- `BRAIN_SUPABASE_URL`
- `BRAIN_SUPABASE_ANON_KEY`

The Library API will use the staging public views. Local generated JSON remains bundled as ingestion evidence and an offline UI fallback. Legacy Notes variables are independent and need not be copied into a Books-only preview.

## 6. Deploy preview only

Import the repository into a new preview hosting project or run the host's preview command after authentication. Confirm the resulting hostname is a provider preview URL and that no custom domain is attached. Smoke-test desktop/mobile navigation, Library search/topic filters, long and short books, incomplete records, grouped passages, and public API privacy.

No project credentials or linkage were available during Stage 4, so these external steps have not been run.
