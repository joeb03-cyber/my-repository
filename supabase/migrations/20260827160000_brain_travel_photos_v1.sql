-- Synergetic Human Brain: travel chronology and privacy-first photo staging.
-- Staging migration only. Never apply to the legacy production project without review.

create table public.travel_source_snapshots (
  id uuid primary key,
  source_url text not null,
  external_id text not null,
  captured_on date not null,
  content_hash text not null,
  snapshot_path text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (external_id, content_hash)
);

create table public.travel_places (
  id uuid primary key,
  slug text not null unique,
  source_name text not null unique,
  name text not null,
  place_type text not null,
  country_code text not null check (char_length(country_code) = 2),
  country_name text not null,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  coordinates_state text not null check (coordinates_state in ('provider_candidate', 'editorial', 'unresolved')),
  visibility text not null default 'public' check (visibility in ('public', 'private', 'excluded')),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

create table public.travel_visits (
  id uuid primary key,
  source_snapshot_id uuid not null references public.travel_source_snapshots(id) on delete restrict,
  place_id uuid not null references public.travel_places(id) on delete restrict,
  visit_kind text not null check (visit_kind in ('visit_or_stay_unspecified', 'visit', 'stay')),
  source_position integer not null,
  group_position integer not null default 1,
  chronology_index integer not null unique,
  start_year smallint not null,
  start_month smallint not null check (start_month between 1 and 12),
  end_year smallint not null,
  end_month smallint not null check (end_month between 1 and 12),
  temporal_precision text not null check (temporal_precision in ('month', 'month_range')),
  source_date_text text not null,
  source_value text not null,
  source_raw_line text not null,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'excluded')),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_snapshot_id, source_position, group_position)
);

create table public.travel_movements (
  id uuid primary key,
  source_snapshot_id uuid not null references public.travel_source_snapshots(id) on delete restrict,
  origin_place_id uuid references public.travel_places(id) on delete restrict,
  destination_place_id uuid references public.travel_places(id) on delete restrict,
  event_kind text not null check (event_kind in ('departure', 'arrival', 'transit')),
  transport_mode text,
  start_year smallint not null,
  start_month smallint not null check (start_month between 1 and 12),
  temporal_precision text not null check (temporal_precision = 'month'),
  source_position integer not null,
  source_raw_line text not null,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'excluded')),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The general media_assets row holds safe technical basics. Photo-specific
-- source metadata remains protected unless explicitly published below.
create table public.photo_assets (
  asset_id uuid primary key references public.media_assets(id) on delete cascade,
  original_filename text not null,
  source_capture_at timestamptz,
  source_capture_timezone text,
  camera_make text,
  camera_model text,
  lens_model text,
  orientation smallint,
  inventory_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photo_private_metadata (
  asset_id uuid primary key references public.photo_assets(asset_id) on delete cascade,
  original_source_path text,
  exact_latitude double precision check (exact_latitude between -90 and 90),
  exact_longitude double precision check (exact_longitude between -180 and 180),
  altitude_meters double precision,
  raw_safe_exif jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((exact_latitude is null) = (exact_longitude is null))
);

create table public.photo_publications (
  asset_id uuid primary key references public.photo_assets(asset_id) on delete cascade,
  place_id uuid references public.travel_places(id) on delete set null,
  visit_id uuid references public.travel_visits(id) on delete set null,
  caption text,
  captured_year smallint,
  captured_month smallint check (captured_month between 1 and 12),
  date_precision text check (date_precision in ('year', 'month', 'day')),
  is_photos_visible boolean not null default false,
  is_favorite boolean not null default false,
  is_wallpaper_candidate boolean not null default false,
  visibility text not null default 'private' check (visibility in ('public', 'private', 'excluded')),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger travel_places_updated_at before update on public.travel_places for each row execute function public.brain_set_updated_at();
create trigger travel_visits_updated_at before update on public.travel_visits for each row execute function public.brain_set_updated_at();
create trigger travel_movements_updated_at before update on public.travel_movements for each row execute function public.brain_set_updated_at();
create trigger photo_assets_updated_at before update on public.photo_assets for each row execute function public.brain_set_updated_at();
create trigger photo_private_metadata_updated_at before update on public.photo_private_metadata for each row execute function public.brain_set_updated_at();
create trigger photo_publications_updated_at before update on public.photo_publications for each row execute function public.brain_set_updated_at();

create index travel_visits_place_idx on public.travel_visits(place_id, chronology_index);
create index travel_visits_source_order_idx on public.travel_visits(source_position, group_position);
create index travel_places_country_idx on public.travel_places(country_code, name);
create index photo_publications_place_idx on public.photo_publications(place_id) where visibility = 'public';

alter table public.travel_source_snapshots enable row level security;
alter table public.travel_places enable row level security;
alter table public.travel_visits enable row level security;
alter table public.travel_movements enable row level security;
alter table public.photo_assets enable row level security;
alter table public.photo_private_metadata enable row level security;
alter table public.photo_publications enable row level security;

create or replace view public.brain_public_places with (security_barrier = true) as
select id, slug, source_name, name, place_type, country_code, country_name,
  latitude, longitude, coordinates_state, editorial_state
from public.travel_places
where visibility = 'public' and editorial_state <> 'rejected';

create or replace view public.brain_public_travel_visits with (security_barrier = true) as
select v.id, v.place_id, v.visit_kind, v.source_position, v.group_position, v.chronology_index,
  v.start_year, v.start_month, v.end_year, v.end_month, v.temporal_precision,
  v.source_date_text, v.source_value, v.source_raw_line, v.editorial_state
from public.travel_visits v
join public.travel_places p on p.id = v.place_id
where v.visibility = 'public' and v.editorial_state <> 'rejected'
  and p.visibility = 'public' and p.editorial_state <> 'rejected';

create or replace view public.brain_public_travel_overview with (security_barrier = true) as
select id, source_url, captured_on, content_hash, source_metadata -> 'intro' as intro
from public.travel_source_snapshots;

create or replace view public.brain_public_travel_movements with (security_barrier = true) as
select id, origin_place_id, destination_place_id, event_kind, transport_mode,
  start_year, start_month, temporal_precision, source_position, source_raw_line, editorial_state
from public.travel_movements
where visibility = 'public' and editorial_state <> 'rejected';

-- Deliberately excludes private EXIF, original paths, and exact photo GPS.
create or replace view public.brain_public_photos with (security_barrier = true) as
select m.id, m.storage_path, m.mime_type, m.width, m.height, p.caption,
  p.captured_year, p.captured_month, p.date_precision, p.place_id, p.visit_id,
  p.is_favorite, p.is_wallpaper_candidate
from public.photo_publications p
join public.photo_assets a on a.asset_id = p.asset_id
join public.media_assets m on m.id = a.asset_id
where p.visibility = 'public' and p.is_photos_visible = true and p.editorial_state <> 'rejected';

revoke all on public.travel_source_snapshots, public.travel_places, public.travel_visits,
  public.travel_movements, public.photo_assets, public.photo_private_metadata, public.photo_publications
  from anon, authenticated;
grant select on public.brain_public_places, public.brain_public_travel_visits,
  public.brain_public_travel_overview, public.brain_public_travel_movements,
  public.brain_public_photos to anon, authenticated;
grant all on public.travel_source_snapshots, public.travel_places, public.travel_visits,
  public.travel_movements, public.photo_assets, public.photo_private_metadata, public.photo_publications to service_role;

comment on table public.travel_visits is 'A place is reusable; each row is a distinct temporal visit/stay assertion. Source does not distinguish visit from stay, so imports use visit_or_stay_unspecified.';
comment on table public.photo_private_metadata is 'Never exposed by a public view. Exact GPS, original source paths, and retained EXIF remain editorial/private by default.';
comment on view public.brain_public_photos is 'Safe publication projection; exact GPS and raw EXIF are structurally absent.';
