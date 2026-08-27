-- Stage 13.5: optional, reviewable Reading -> Book relationship.
-- Apply to isolated staging only until accepted.

create table if not exists public.current_state_entity_links (
  snapshot_id uuid not null references public.current_state_snapshots(id) on delete cascade,
  role text not null check (role in ('reading')),
  entity_id uuid not null references public.entities(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, role)
);

create index if not exists current_state_entity_links_entity_idx
  on public.current_state_entity_links(entity_id, role);

alter table public.current_state_entity_links enable row level security;

create or replace function public.is_linkable_public_book(candidate_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.entities e
    where e.id = candidate_id
      and e.kind = 'book'
      and e.visibility = 'public'
      and e.lifecycle_state <> 'archived'
  );
$$;

revoke all on function public.is_linkable_public_book(uuid) from public;
grant execute on function public.is_linkable_public_book(uuid) to authenticated, service_role;

drop policy if exists brain_admin_current_state_entity_links on public.current_state_entity_links;
create policy brain_admin_current_state_entity_links on public.current_state_entity_links
  for all to authenticated
  using (public.is_brain_admin())
  with check (
    public.is_brain_admin()
    and public.is_linkable_public_book(entity_id)
  );

grant select, insert, update, delete on public.current_state_entity_links to authenticated;
grant all on public.current_state_entity_links to service_role;

create or replace view public.brain_public_current_state_reading
with (security_barrier = true)
as
select
  l.snapshot_id,
  e.id as book_id,
  e.slug,
  e.title,
  b.original_author,
  m.storage_path as cover_path
from public.current_state_entity_links l
join public.current_state_snapshots s on s.id = l.snapshot_id
join public.entities e on e.id = l.entity_id
join public.books b on b.entity_id = e.id
left join public.media_assets m on m.id = b.cover_asset_id and m.editorial_state <> 'rejected'
where l.role = 'reading'
  and s.publication_state = 'published'
  and e.kind = 'book'
  and e.visibility = 'public'
  and e.lifecycle_state <> 'archived';

grant select on public.brain_public_current_state_reading to anon, authenticated;

comment on table public.current_state_entity_links is 'Optional typed links from immutable current-state snapshots to Brain entities; free-text fallbacks remain in snapshot JSON.';
