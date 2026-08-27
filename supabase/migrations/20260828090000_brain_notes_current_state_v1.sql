-- Synergetic Human Brain: public Notes and one maintainable current-state source.
-- Staging-only until the editorial model and editor flow are approved.

alter table public.entities drop constraint if exists entities_kind_check;
alter table public.entities add constraint entities_kind_check
  check (kind in ('book', 'person', 'topic', 'highlight', 'place', 'note'));

create table if not exists public.note_folders (
  id uuid primary key,
  slug text not null unique,
  label text not null,
  sort_order integer not null default 100,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'excluded')),
  editorial_state text not null default 'approved' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brain_notes (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  folder_id uuid references public.note_folders(id) on delete set null,
  excerpt text not null default '',
  body_markdown text not null,
  body_format text not null default 'markdown' check (body_format = 'markdown'),
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'archived')),
  pinned boolean not null default false,
  source_published_at date,
  published_at timestamptz,
  editorial_notice text,
  external_links jsonb not null default '[]'::jsonb,
  media jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (publication_state <> 'published' or published_at is not null)
);

create table if not exists public.note_tags (
  id uuid primary key,
  slug text not null unique,
  label text not null,
  editorial_state text not null default 'approved' check (editorial_state in ('suggested', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.note_tag_links (
  note_entity_id uuid not null references public.brain_notes(entity_id) on delete cascade,
  tag_id uuid not null references public.note_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_entity_id, tag_id)
);

create table if not exists public.current_state_snapshots (
  id uuid primary key,
  effective_at timestamptz not null,
  last_confirmed_at timestamptz not null,
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'archived')),
  state jsonb not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists note_folders_updated_at on public.note_folders;
create trigger note_folders_updated_at before update on public.note_folders
  for each row execute function public.brain_set_updated_at();
drop trigger if exists brain_notes_updated_at on public.brain_notes;
create trigger brain_notes_updated_at before update on public.brain_notes
  for each row execute function public.brain_set_updated_at();
drop trigger if exists current_state_snapshots_updated_at on public.current_state_snapshots;
create trigger current_state_snapshots_updated_at before update on public.current_state_snapshots
  for each row execute function public.brain_set_updated_at();

alter table public.note_folders enable row level security;
alter table public.brain_notes enable row level security;
alter table public.note_tags enable row level security;
alter table public.note_tag_links enable row level security;
alter table public.current_state_snapshots enable row level security;

grant all on public.note_folders, public.brain_notes, public.note_tags, public.note_tag_links, public.current_state_snapshots to service_role;

create or replace view public.brain_public_note_folders
with (security_barrier = true)
as
select id, slug, label, sort_order
from public.note_folders
where visibility = 'public' and editorial_state = 'approved';

create or replace view public.brain_public_notes
with (security_barrier = true)
as
select
  entity.id,
  entity.slug,
  entity.title,
  note.excerpt,
  note.body_markdown,
  folder.slug as folder_slug,
  folder.label as folder_label,
  note.pinned,
  note.source_published_at,
  note.published_at,
  note.updated_at,
  note.editorial_notice,
  note.external_links,
  coalesce((
    select jsonb_agg(tag.label order by tag.label)
    from public.note_tag_links tag_link
    join public.note_tags tag on tag.id = tag_link.tag_id
    where tag_link.note_entity_id = entity.id and tag.editorial_state = 'approved'
  ), '[]'::jsonb) as tags
from public.entities entity
join public.brain_notes note on note.entity_id = entity.id
left join public.note_folders folder on folder.id = note.folder_id
where entity.kind = 'note'
  and entity.visibility = 'public'
  and entity.lifecycle_state = 'active'
  and entity.editorial_state = 'approved'
  and note.publication_state = 'published'
  and (folder.id is null or (folder.visibility = 'public' and folder.editorial_state = 'approved'));

create or replace view public.brain_public_current_state
with (security_barrier = true)
as
select id, effective_at, last_confirmed_at, state
from public.current_state_snapshots
where publication_state = 'published'
order by effective_at desc
limit 1;

grant select on public.brain_public_note_folders, public.brain_public_notes, public.brain_public_current_state to anon, authenticated;

comment on view public.brain_public_notes is 'Only approved, published public Notes. Draft bodies, provenance, and private editorial metadata are omitted.';
comment on view public.brain_public_current_state is 'One public-safe, manually maintained current-state snapshot. No inferred health or psychological measurements.';
