-- Stage 4.2: visit reflections, a second current-reading relationship, and
-- three editorially identified undated photographs. Isolated staging only.

-- Reflections are an editorial overlay on the immutable visit chronology.
-- Only public_blurb is projected anonymously for now; the structured fields
-- are reserved for later Control Center work.
create table if not exists public.travel_visit_editorial (
  visit_id uuid primary key references public.travel_visits(id) on delete cascade,
  public_blurb text check (char_length(public_blurb) <= 2000),
  where_stayed text check (char_length(where_stayed) <= 500),
  favorite_things jsonb not null default '[]'::jsonb,
  food_drink jsonb not null default '[]'::jsonb,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  editorial_state text not null default 'approved' check (editorial_state in ('needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists travel_visit_editorial_updated_at on public.travel_visit_editorial;
create trigger travel_visit_editorial_updated_at before update on public.travel_visit_editorial
  for each row execute function public.brain_set_updated_at();

alter table public.travel_visit_editorial enable row level security;
drop policy if exists brain_admin_travel_visit_editorial on public.travel_visit_editorial;
create policy brain_admin_travel_visit_editorial on public.travel_visit_editorial
  for all to authenticated
  using (public.is_brain_admin())
  with check (public.is_brain_admin());

revoke all on public.travel_visit_editorial from anon;
grant select, insert, update, delete on public.travel_visit_editorial to authenticated;
grant all on public.travel_visit_editorial to service_role;

create or replace view public.brain_public_travel_visits with (security_barrier = true) as
select v.id, v.place_id, v.visit_kind, v.source_position, v.group_position, v.chronology_index,
  v.start_year, v.start_month, v.end_year, v.end_month, v.temporal_precision,
  v.source_date_text, v.source_value, v.source_raw_line, v.editorial_state,
  nullif(trim(e.public_blurb), '') as public_blurb
from public.travel_visits v
join public.travel_places p on p.id = v.place_id
left join public.travel_visit_editorial e on e.visit_id = v.id
  and e.visibility = 'public' and e.editorial_state = 'approved'
where v.visibility = 'public' and v.editorial_state <> 'rejected'
  and p.visibility = 'public' and p.editorial_state <> 'rejected';

grant select on public.brain_public_travel_visits to anon, authenticated;

-- Keep the original `reading` role for backwards compatibility and add one
-- optional secondary slot. Each immutable NOW snapshot may link both.
alter table public.current_state_entity_links
  drop constraint if exists current_state_entity_links_role_check;
alter table public.current_state_entity_links
  add constraint current_state_entity_links_role_check
  check (role in ('reading', 'reading_secondary'));

drop view if exists public.brain_public_current_state_reading;
create view public.brain_public_current_state_reading
with (security_barrier = true)
as
select
  l.snapshot_id,
  l.role,
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
where l.role in ('reading', 'reading_secondary')
  and s.publication_state = 'published'
  and e.kind = 'book'
  and e.visibility = 'public'
  and e.lifecycle_state <> 'archived';

grant select on public.brain_public_current_state_reading to anon, authenticated;

-- Joe identified these source-undated images by sight. Dates remain null.
-- Bali and Helsinki connect to their known visit. Sayulita remains the public
-- locality while its day-trip context connects to the Puerto Vallarta visit.
update public.photo_publications
set display_place = 'Bali', country_name = 'Indonesia',
    visit_id = '4f25eae6-4587-5527-8806-ea5c021dc57d',
    place_id = '19518562-5e1d-55d7-81e6-55fd770a2ef8'
where asset_id = '82f6ab9e-c091-5ceb-91d1-0ccf95ea8375';

update public.photo_publications
set display_place = 'Helsinki', country_name = 'Finland',
    visit_id = '9d0d5326-3602-59bc-beea-a0b543022ad6',
    place_id = '22a5eddc-9106-5388-9b3d-6afe29879b3a'
where asset_id = '4a07a793-1143-5e5e-b6f1-2ea43908aedd';

update public.photo_publications
set display_place = 'Sayulita', country_name = 'Mexico',
    visit_id = '22e236a2-61e0-5b80-94d8-06a46c984f01',
    place_id = 'df3df4f9-64d4-553c-8c2a-f4091e647adb'
where asset_id = '78f6b8a5-666c-5fa1-add6-f41a7160aae3';

-- Preserve prior relationship assertions and add explicit editorial overlays.
update public.photo_visit_relationships
set active = false
where asset_id in (
  '82f6ab9e-c091-5ceb-91d1-0ccf95ea8375',
  '4a07a793-1143-5e5e-b6f1-2ea43908aedd',
  '78f6b8a5-666c-5fa1-add6-f41a7160aae3'
) and active = true;

insert into public.photo_visit_relationships
  (id, asset_id, place_id, visit_id, relationship_state, relationship_method, active, provenance)
values
  ('88a9dc91-9cad-5597-afaa-6ad05ccfc55b', '82f6ab9e-c091-5ceb-91d1-0ccf95ea8375', '19518562-5e1d-55d7-81e6-55fd770a2ef8', '4f25eae6-4587-5527-8806-ea5c021dc57d', 'editorial_confident', 'joe_visual_identification', true, '{"authority":"Joe Burt","recorded":"2026-08-29","datePreservedAsUndated":true}'::jsonb),
  ('aab1aa79-60a2-5ee0-820b-f52712074e3e', '4a07a793-1143-5e5e-b6f1-2ea43908aedd', '22a5eddc-9106-5388-9b3d-6afe29879b3a', '9d0d5326-3602-59bc-beea-a0b543022ad6', 'editorial_confident', 'joe_visual_identification', true, '{"authority":"Joe Burt","recorded":"2026-08-29","datePreservedAsUndated":true}'::jsonb),
  ('dd4cd6ae-6d35-59f3-91ba-1ab0aa73eb82', '78f6b8a5-666c-5fa1-add6-f41a7160aae3', 'df3df4f9-64d4-553c-8c2a-f4091e647adb', '22e236a2-61e0-5b80-94d8-06a46c984f01', 'editorial_confident', 'joe_visual_identification_day_trip', true, '{"authority":"Joe Burt","recorded":"2026-08-29","publicLocality":"Sayulita","visitContext":"Puerto Vallarta","datePreservedAsUndated":true}'::jsonb)
on conflict (id) do update set active = excluded.active, provenance = excluded.provenance;
