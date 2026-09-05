# Production readiness audit

Audited 2026-09-05. This is a read-only assessment of the current production system and a launch assessment of the new Synergetic Human OS. It contains no credentials or private archive material.

## Decision

**READY FOR A CONTROLLED CUTOVER after the final staging acceptance and the two account-level checks below.** The application build, public/private data boundary, isolated Brain, and rollback path are sound. Production has not been changed.

Before moving the domains:

1. Joe should enable two-factor authentication on the Vercel account. Vercel currently presents the account as single-factor.
2. Joe should complete one fresh Control Center magic-link login on the deployed staging build. The code now uses Supabase's PKCE code exchange while retaining compatibility with already-issued implicit links.

## Current architecture

| Layer | Existing production | New staging candidate |
| --- | --- | --- |
| Hosting | Vercel project `personalwebsite` | Isolated Vercel project `synergetic-human-staging` |
| Public domains | `www.synergetichuman.com` plus apex redirect | `synergetic-human-staging.vercel.app` only |
| Code | GitHub `main`, legacy Notes site | local `codex/os-prototype`, direct staging deployments |
| Data | legacy production Supabase referenced by the old app | isolated Brain project `agzcvkdmlrumuqefbtcb` |
| Indexing | production is indexable; current `/robots.txt` returns 404 | `robots.txt` disallows all and page metadata is `noindex` |
| Control Center | none | `/control`, Supabase Auth + one-person database allowlist + RLS |

The Vercel projects and Supabase projects are separate. No staging environment contains a service-role key in browser or Vercel runtime configuration.

## BLOCKERS

- **Account security:** enable Vercel 2FA before attaching the public domains to the new project.
- **Final administrator login test:** request and complete a new staging magic link after this deployment. Supabase's Site URL and exact allowed callback already point at the staging domain. The application now exchanges a short-lived PKCE authorization code into cookie-backed SSR session state, matching Supabase's recommended server-side pattern.
- **Cutover configuration is intentionally absent:** the new Vercel project does not yet have production-domain Auth redirects or a `SITE_ENV=production` release configuration. Add these only during the approved cutover.

## Resolved during this pass

- Upgraded Next.js from 14.1.2 to the patched 14.2.35 release. The official Next.js security advisory directs 14.0/14.1 applications to 14.2.35: <https://nextjs.org/blog/security-update-2025-12-11>.
- Replaced the obsolete legacy Notes database dependency on `/notes`, preventing stale environment variables from causing 500 responses. `/notes` now enters Journal and old `/notes/{slug}` URLs open the corresponding public Note.
- Repaired sitemap generation so staging remains empty/non-indexing and a production sitemap can be built from public Brain Notes.
- Added the private original-photo bucket, public derivatives, private EXIF/GPS table, protected upload preparation/finalization, and admin-only policies.
- Added editable Messages conversations, alternating message records, per-reply sources, publication states, admin-only base tables, and public safe projections.
- Switched new Control Center magic links to PKCE while accepting previously issued implicit links during the transition. Supabase documents exact production redirects and PKCE code exchange here: <https://supabase.com/docs/guides/auth/redirect-urls> and <https://supabase.com/docs/guides/auth/sessions/pkce-flow>.

## Security and privacy validation

- `/control` is server-protected and redirects anonymous requests to `/control/login`.
- Every Control Center API route independently calls `getControlAdmin`; middleware is session-refresh support, not the sole authorization boundary.
- `getControlAdmin` verifies the Auth user and an active row in `brain_admin_users`.
- Public signup is disabled; there is one active administrator.
- Base editorial tables use RLS and are unavailable to anonymous clients.
- Public pages read curated `brain_public_*` views rather than editorial tables.
- Draft Notes and draft Messages are absent from public views.
- Private original photos live in a non-public bucket; exact coordinates and safe EXIF are in an admin-only table. Public surfaces receive only optimized WebP derivatives and editorial place/date fields.
- No secret files are tracked. No service-role credential appears in client code or hosting variables. Service-role references are confined to local import/validation scripts and database grants.
- Staging emits `Disallow: /`, `noindex`, and private/no-store responses for sensitive editor data.

The latest isolated-Brain validation recorded 13 editable/public conversations, 142 public messages, denied anonymous access to Messages base tables, denied access to private photo metadata and originals, and confirmed the original bucket is not public.

## POLISH

- Photo upload v1 handles JPEG, PNG, WebP, HEIC and HEIF where the browser can decode them. Live Photo motion is intentionally excluded; the still component is sufficient for v1.
- Optimized photo derivatives use unguessable UUID paths in the public media bucket. A photo unchecked as Public is excluded from every public database view, but its derivatives are already in that bucket. Before using the Private toggle for genuinely sensitive material, move private derivatives to an authenticated bucket and copy them to public storage only on publication.
- Photo finalization is a short sequence of protected inserts rather than one database transaction. Add transactional finalization and failed-upload cleanup before a high-volume ingestion workflow.
- Several components deliberately use plain `<img>` elements. This is acceptable with pre-sized WebP assets, but high-traffic image performance could be improved after launch.
- The Auth callback is resilient to old and new links, but email security scanners can still consume one-time links before Joe opens them. If this becomes recurrent, add a human-confirmation landing step rather than weakening the allowlist.
- The public OS shares a compact initial bundle, while Control Center is intentionally larger. Continue monitoring real-device performance as the private editor grows.

## OPTIONAL

- Connect the staging Vercel project to the development branch after deciding whether archive-derived public content should continue living in the public Git repository. Direct CLI deployments are currently safer and explicit.
- Add application monitoring and error reporting after choosing a privacy policy and retention level.
- Introduce a separate post-launch staging Brain cloned from production once the currently validated staging Brain becomes production.
- Update secondary tooling dependencies and remove legacy Supabase utility files after the old Notes product is retired.

## Rollback

The existing production Vercel project and legacy Supabase remain intact. The fastest rollback is to detach `synergetichuman.com` and `www.synergetichuman.com` from the new project and reattach them to `personalwebsite`. Do not delete the legacy deployment or database during the launch window. Keep both Auth callback URLs allowlisted until the new release is stable.

## Exact cutover sequence

1. Record the current `personalwebsite` production deployment URL and export/backup the legacy production Supabase project.
2. Freeze and tag the accepted `codex/os-prototype` commit. Preserve the current staging deployment URL.
3. Enable Vercel 2FA and successfully test one new staging PKCE magic link.
4. Add the final release environment to the new Vercel project: the validated Brain URL and anon key, `BRAIN_DATA_SOURCE=supabase`, `SITE_ENV=production`, and `NEXT_PUBLIC_SITE_URL=https://www.synergetichuman.com`. Never add a service-role key.
5. In Supabase Auth, set the production Site URL to `https://www.synergetichuman.com` and add the exact callback `https://www.synergetichuman.com/control/auth/callback`. Keep the staging callback during transition.
6. Deploy the frozen commit to the new Vercel project and verify its generated deployment URL before touching domains.
7. Move `www.synergetichuman.com` and the apex redirect from `personalwebsite` to `synergetic-human-staging`. Because both projects are already in Vercel, this should not require a registrar DNS redesign.
8. Verify HTTPS, apex redirect, desktop/mobile home, Library reader, Browser trails, Maps/Photos, public Notes, `/robots.txt`, `/sitemap.xml`, and Control Center login/write/read-back.
9. If a blocker appears, immediately move both domains back to `personalwebsite`; no database rollback is required because the legacy production system was never overwritten.
10. After an agreed stability window, rename the new hosting project, create a fresh isolated staging Supabase clone, point the staging URL to it, and archive—but do not immediately delete—the legacy system.
