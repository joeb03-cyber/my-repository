# Stage 12 — Synergetic Human Control Center

Status: isolated staging  
Public OS: <https://synergetic-human-staging.vercel.app/>  
Private Control Center: <https://synergetic-human-staging.vercel.app/control>

## Product boundary

The public OS remains the experience. Control Center is a private, deliberately small maintenance surface for four frequently changing domains: Notes, NOW, Software Update, and Trash. It does not expose Brain tables, IDs, schemas, provenance records, import concepts, commits, or deployment controls.

## Authentication and authorization

- Supabase Auth provides passwordless email magic links.
- Public signup and anonymous sign-in are disabled in the isolated staging project.
- The application requests magic links with `shouldCreateUser: false`.
- One pre-provisioned Auth user is allowlisted in `brain_admin_users`.
- Authentication alone does not grant editorial rights. `is_brain_admin()` must also return true.
- `/control` is server-protected and redirects unauthenticated or non-admin visitors to login.
- `/api/control/*` repeats authentication and allowlist verification.
- Authenticated API operations use the public anon key plus Joe’s short-lived session. The service-role key never reaches the browser.
- RLS opens only Note entities, Note editorial tables, current-state snapshots, Software Update, and Trash to the allowlisted administrator.
- Books, People, Sources, provenance, travel, imports, and unrelated Brain records remain inaccessible to the Control Center role.
- Drafts require a private entity plus `draft` state. Public Notes still require explicit public, active, approved, and published states.

## Notes workflow

The editor uses ordered visual blocks—title, heading, text, bullet, and quotation—then serializes them to portable Markdown underneath. Joe never needs to type or understand Markdown syntax.

Capabilities include create, edit, save draft, private preview, publish, update published copy, unpublish, pin, title, slug, folder, tags, writing blocks, external links, source date, editorial context, and recoverable archive. Publication and archive actions require confirmation. Draft/published state is visually prominent.

## NOW

One short form updates the public system state centrally. Blank fields are valid. Supported fields are city, country, coordinates, Reading, Thinking, Current Thought, Rabbit Holes, Experiments, Training, Eating Lately, Listening, Trying to Understand, Making, Current Question, and Human Battery. Battery reporting is opt-in and manual.

Each save creates a new current snapshot and archives the prior published snapshot. This retains history while giving every public surface one authoritative current value.

## Software Update and Trash

Software Update supports a version label and reorderable short lists for New, Currently Exploring, Performance, and Known Issues. Trash supports title, description, category, optional date, active/trashed/restored state, public/private visibility, and recoverable archive. Public Put Back remains a playful local interaction; Control Center’s restored state removes a record centrally from the public Trash view.

## Mobile behavior

Below 720px the editor becomes an app-like flow rather than a compressed dashboard: a fixed four-module tab bar, full-screen Note list, full-screen editor, large writing controls, stacked fields, and phone-safe preview. NOW and short Notes can be updated one-handed without horizontal tables.

## Security validation

The automated staging test verifies:

- allowlisted passwordless session succeeds;
- admin reads and writes only the intended Note surface;
- unrelated People-table access is denied;
- an authenticated non-admin cannot write;
- a draft created through the administrator session is absent anonymously;
- public signup is disabled;
- temporary test users and records are removed;
- no service-role credential is used by browser code.

## Use

1. Open the private Control Center URL.
2. Enter Joe’s allowlisted email address.
3. Open the private sign-in link sent by Supabase. No password is required.
4. Choose Notes, NOW, Software Update, or Trash from the navigation.
5. Save. Public readers receive the change from staging within roughly thirty seconds.
6. Use **Sign out** on a shared device. Sessions otherwise refresh securely through Supabase cookies.

## Deferred

Media library, image upload, entity-link autocomplete, folder management, revision comparison/restore UI, additional administrators, production rollout, rich inline styling, AI writing, and new public applications remain outside Stage 12. The schema already leaves room for note media and future Book/Place linking without requiring either for a quick update.
