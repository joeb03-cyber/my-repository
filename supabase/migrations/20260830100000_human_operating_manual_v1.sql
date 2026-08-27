-- Stage 14: curated Human operating manual.
-- Apply to the isolated staging Brain only until accepted.

create table if not exists public.human_entries (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  section text not null check (section in ('inner_life', 'environment', 'rhythms_recovery', 'movement', 'food', 'frontiers')),
  relationship_state text not null check (relationship_state in ('do_this', 'do_more', 'believe_matters', 'exploring')),
  entry_type text not null default 'principle' check (entry_type in ('principle', 'practice', 'model', 'tool')),
  title text not null,
  summary text not null default '',
  current_take text not null default '',
  supporting_details jsonb not null default '[]'::jsonb,
  publication_state text not null default 'draft' check (publication_state in ('draft', 'published', 'archived')),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  editorial_state text not null default 'needs_review' check (editorial_state in ('needs_review', 'approved', 'rejected')),
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.human_entry_entity_links (
  human_entry_id uuid not null references public.human_entries(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  relationship_label text not null default 'Related',
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (human_entry_id, entity_id, relationship_label)
);

create index if not exists human_entries_public_order_idx
  on public.human_entries(section, sort_order)
  where publication_state = 'published' and visibility = 'public' and editorial_state = 'approved';

drop trigger if exists human_entries_updated_at on public.human_entries;
create trigger human_entries_updated_at before update on public.human_entries
  for each row execute function public.brain_set_updated_at();

alter table public.human_entries enable row level security;
alter table public.human_entry_entity_links enable row level security;

drop policy if exists brain_admin_human_entries on public.human_entries;
create policy brain_admin_human_entries on public.human_entries for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

drop policy if exists brain_admin_human_links on public.human_entry_entity_links;
create policy brain_admin_human_links on public.human_entry_entity_links for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select, insert, update on public.human_entries, public.human_entry_entity_links to authenticated;
grant delete on public.human_entry_entity_links to authenticated;
grant all on public.human_entries, public.human_entry_entity_links to service_role;

create or replace view public.brain_public_human_entries
with (security_barrier = true)
as
select id, slug, section, relationship_state, entry_type, title, summary, current_take,
  supporting_details, sort_order, updated_at
from public.human_entries
where publication_state = 'published'
  and visibility = 'public'
  and editorial_state = 'approved'
order by case section
  when 'inner_life' then 1
  when 'environment' then 2
  when 'rhythms_recovery' then 3
  when 'movement' then 4
  when 'food' then 5
  when 'frontiers' then 6
  else 99 end,
  sort_order, title;

create or replace view public.brain_public_human_relationships
with (security_barrier = true)
as
select links.human_entry_id,
  entities.id as entity_id,
  entities.kind as entity_kind,
  entities.slug as entity_slug,
  entities.title as entity_title,
  links.relationship_label,
  links.sort_order
from public.human_entry_entity_links links
join public.human_entries entries on entries.id = links.human_entry_id
join public.entities entities on entities.id = links.entity_id
where entries.publication_state = 'published'
  and entries.visibility = 'public'
  and entries.editorial_state = 'approved'
  and entities.visibility = 'public'
  and entities.lifecycle_state = 'active'
  and entities.editorial_state = 'approved'
order by links.human_entry_id, links.sort_order, entities.title;

grant select on public.brain_public_human_entries, public.brain_public_human_relationships to anon, authenticated;

comment on table public.human_entries is 'Joe-authored curated Human operating-manual entries. Provenance and drafts remain private.';
comment on table public.human_entry_entity_links is 'Small editorial relationships from Human entries to existing Brain entities.';
comment on view public.brain_public_human_entries is 'Published Human content only; provenance, drafts, and private editorial state are structurally excluded.';
comment on view public.brain_public_human_relationships is 'Approved public Human relationships to approved public Brain entities only.';
