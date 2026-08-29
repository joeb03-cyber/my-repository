-- Stage 4: curated travel photographs as part of the lived-history Brain.
-- Prepared for the isolated staging project only. Originals, MOV components,
-- source paths, and exact GPS remain outside every public projection.

alter table public.photo_assets
  add column if not exists source_logical_asset_id uuid unique,
  add column if not exists media_kind text not null default 'still_photo'
    check (media_kind in ('still_photo', 'live_photo')),
  add column if not exists has_private_motion boolean not null default false,
  add column if not exists original_pixel_width integer,
  add column if not exists original_pixel_height integer;

alter table public.photo_publications
  add column if not exists captured_on date,
  add column if not exists display_place text,
  add column if not exists country_name text,
  add column if not exists display_orientation text
    check (display_orientation in ('portrait', 'landscape', 'square', 'unknown'));

create table if not exists public.photo_derivatives (
  id uuid primary key,
  asset_id uuid not null references public.photo_assets(asset_id) on delete cascade,
  variant text not null check (variant in ('small', 'medium', 'large')),
  storage_path text not null unique,
  mime_type text not null check (mime_type = 'image/webp'),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null,
  created_at timestamptz not null default now(),
  unique (asset_id, variant)
);

-- Relationship assertions are an editorial overlay. Re-pointing a photo later
-- does not rewrite capture metadata or the visit chronology.
create table if not exists public.photo_visit_relationships (
  id uuid primary key,
  asset_id uuid not null references public.photo_assets(asset_id) on delete cascade,
  place_id uuid references public.travel_places(id) on delete set null,
  visit_id uuid references public.travel_visits(id) on delete set null,
  relationship_state text not null check (relationship_state in ('strong', 'moderate', 'editorial_confident', 'unresolved')),
  relationship_method text not null,
  active boolean not null default true,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists photo_visit_relationships_one_active
  on public.photo_visit_relationships(asset_id) where active = true;

-- Explicit only: city-name coincidence in prose must never create this link.
create table if not exists public.note_visit_links (
  note_entity_id uuid not null references public.brain_notes(entity_id) on delete cascade,
  visit_id uuid not null references public.travel_visits(id) on delete cascade,
  label text,
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (note_entity_id, visit_id)
);

drop trigger if exists photo_visit_relationships_updated_at on public.photo_visit_relationships;
create trigger photo_visit_relationships_updated_at before update on public.photo_visit_relationships
  for each row execute function public.brain_set_updated_at();

alter table public.photo_derivatives enable row level security;
alter table public.photo_visit_relationships enable row level security;
alter table public.note_visit_links enable row level security;

drop policy if exists brain_admin_photo_assets on public.photo_assets;
create policy brain_admin_photo_assets on public.photo_assets for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_photo_publications on public.photo_publications;
create policy brain_admin_photo_publications on public.photo_publications for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_photo_relationships on public.photo_visit_relationships;
create policy brain_admin_photo_relationships on public.photo_visit_relationships for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_photo_derivatives on public.photo_derivatives;
create policy brain_admin_photo_derivatives on public.photo_derivatives for select to authenticated
  using (public.is_brain_admin());
drop policy if exists brain_admin_note_visit_links on public.note_visit_links;
create policy brain_admin_note_visit_links on public.note_visit_links for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select, update on public.photo_assets, public.photo_publications to authenticated;
grant select, insert, update on public.photo_visit_relationships to authenticated;
grant select on public.photo_derivatives to authenticated;
grant select, insert, update, delete on public.note_visit_links to authenticated;
grant all on public.photo_derivatives, public.photo_visit_relationships, public.note_visit_links to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brain-public-media', 'brain-public-media', true, 8388608, array['image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- The view is the entire anonymous photo contract. It deliberately omits raw
-- filenames, source paths/hashes, exact GPS, MOV paths, and private EXIF.
create or replace view public.brain_public_lived_photos with (security_barrier = true) as
select
  p.asset_id as id,
  p.captured_on as capture_date,
  p.captured_year,
  p.captured_month,
  p.date_precision,
  a.original_pixel_width as width,
  a.original_pixel_height as height,
  p.display_orientation,
  r.visit_id,
  r.place_id,
  tp.name as visit_place,
  p.display_place,
  p.country_name,
  coalesce(r.relationship_state, 'unresolved') as relationship_state,
  p.is_wallpaper_candidate,
  a.has_private_motion,
  ds.storage_path as small_storage_path,
  dm.storage_path as medium_storage_path,
  dl.storage_path as large_storage_path
from public.photo_publications p
join public.photo_assets a on a.asset_id = p.asset_id
left join public.photo_visit_relationships r on r.asset_id = p.asset_id and r.active = true
left join public.travel_places tp on tp.id = r.place_id
join public.photo_derivatives ds on ds.asset_id = p.asset_id and ds.variant = 'small'
join public.photo_derivatives dm on dm.asset_id = p.asset_id and dm.variant = 'medium'
join public.photo_derivatives dl on dl.asset_id = p.asset_id and dl.variant = 'large'
where p.visibility = 'public' and p.is_photos_visible = true and p.editorial_state = 'approved';

revoke all on public.photo_derivatives, public.photo_visit_relationships, public.note_visit_links from anon;
grant select on public.brain_public_lived_photos to anon, authenticated;

comment on table public.photo_visit_relationships is 'Reviewable place/visit interpretation kept separate from immutable capture/source metadata.';
comment on table public.note_visit_links is 'Manually curated Note-to-Visit relationships only; never inferred from matching prose.';
comment on view public.brain_public_lived_photos is 'Anonymous safe projection for curated still derivatives; no raw GPS, filenames, source paths, or Live Photo MOVs.';
