-- Synergetic Human Control Center: one-admin authorization and editable OS state.
-- Isolated staging only until the private editor is reviewed.

create table if not exists public.brain_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null default 'Joe',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_brain_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brain_admin_users admin_user
    where admin_user.user_id = auth.uid() and admin_user.active = true
  );
$$;

revoke all on function public.is_brain_admin() from public;
grant execute on function public.is_brain_admin() to authenticated, service_role;

create table if not exists public.software_update_snapshots (
  id uuid primary key,
  version_label text not null,
  new_items jsonb not null default '[]'::jsonb,
  exploring_items jsonb not null default '[]'::jsonb,
  performance_items jsonb not null default '[]'::jsonb,
  known_issue_items jsonb not null default '[]'::jsonb,
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'archived')),
  effective_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.os_trash_records (
  id uuid primary key,
  title text not null,
  description text not null default '',
  category text not null default 'other',
  trashed_at date,
  state text not null default 'trashed' check (state in ('active', 'trashed', 'restored', 'archived')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists brain_admin_users_updated_at on public.brain_admin_users;
create trigger brain_admin_users_updated_at before update on public.brain_admin_users
  for each row execute function public.brain_set_updated_at();
drop trigger if exists software_update_snapshots_updated_at on public.software_update_snapshots;
create trigger software_update_snapshots_updated_at before update on public.software_update_snapshots
  for each row execute function public.brain_set_updated_at();
drop trigger if exists os_trash_records_updated_at on public.os_trash_records;
create trigger os_trash_records_updated_at before update on public.os_trash_records
  for each row execute function public.brain_set_updated_at();

alter table public.brain_admin_users enable row level security;
alter table public.software_update_snapshots enable row level security;
alter table public.os_trash_records enable row level security;

drop policy if exists brain_admin_read_self on public.brain_admin_users;
create policy brain_admin_read_self on public.brain_admin_users for select to authenticated
  using (user_id = auth.uid() and active = true);

-- Existing Brain tables remain closed by default. These policies open only the
-- small editorial surface to the allowlisted administrator.
drop policy if exists brain_admin_note_entities on public.entities;
create policy brain_admin_note_entities on public.entities for all to authenticated
  using (public.is_brain_admin() and kind = 'note')
  with check (public.is_brain_admin() and kind = 'note');

drop policy if exists brain_admin_note_folders on public.note_folders;
create policy brain_admin_note_folders on public.note_folders for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_notes on public.brain_notes;
create policy brain_admin_notes on public.brain_notes for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_note_tags on public.note_tags;
create policy brain_admin_note_tags on public.note_tags for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_note_tag_links on public.note_tag_links;
create policy brain_admin_note_tag_links on public.note_tag_links for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_current_state on public.current_state_snapshots;
create policy brain_admin_current_state on public.current_state_snapshots for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_software_updates on public.software_update_snapshots;
create policy brain_admin_software_updates on public.software_update_snapshots for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_trash on public.os_trash_records;
create policy brain_admin_trash on public.os_trash_records for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select on public.brain_admin_users to authenticated;
grant select, insert, update on public.entities, public.note_folders, public.brain_notes,
  public.note_tags, public.note_tag_links, public.current_state_snapshots,
  public.software_update_snapshots, public.os_trash_records to authenticated;
grant delete on public.note_tag_links to authenticated;
grant all on public.brain_admin_users, public.software_update_snapshots, public.os_trash_records to service_role;

create or replace view public.brain_public_software_update
with (security_barrier = true)
as
select id, version_label, new_items, exploring_items, performance_items, known_issue_items, effective_at
from public.software_update_snapshots
where publication_state = 'published'
order by effective_at desc
limit 1;

create or replace view public.brain_public_trash
with (security_barrier = true)
as
select id, title, description, category, trashed_at, sort_order
from public.os_trash_records
where visibility = 'public' and state = 'trashed'
order by sort_order, trashed_at desc nulls last;

grant select on public.brain_public_software_update, public.brain_public_trash to anon, authenticated;

comment on table public.brain_admin_users is 'Explicit one-person Control Center allowlist. Authentication alone does not grant editorial access.';
comment on view public.brain_public_software_update is 'Published playful update data only; no private editor state.';
comment on view public.brain_public_trash is 'Explicitly public, sample-safe Trash records only.';
