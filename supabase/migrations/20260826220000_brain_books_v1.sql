-- Synergetic Human Brain: Books vertical slice
-- Development migration only. Do not apply to the legacy production project without review.

create extension if not exists pgcrypto;

create or replace function public.brain_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.entities (
  id uuid primary key,
  kind text not null check (kind in ('book', 'person', 'topic', 'highlight')),
  slug text not null unique,
  title text not null,
  summary text,
  visibility text not null default 'public' check (visibility in ('public', 'private', 'excluded')),
  lifecycle_state text not null default 'active' check (lifecycle_state in ('active', 'incomplete', 'archived')),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  display_name text not null,
  sort_name text,
  normalized_name text not null unique
);

create table public.media_assets (
  id uuid primary key,
  kind text not null check (kind in ('book_cover', 'image', 'document')),
  storage_path text,
  source_url text,
  provider text,
  provider_identifier text,
  mime_type text,
  byte_size bigint,
  width integer,
  height integer,
  sha256 text,
  confidence numeric(5,4),
  editorial_state text not null default 'unreviewed' check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_identifier, kind)
);

create table public.books (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  source_position integer not null unique,
  original_title text not null,
  original_author text,
  subtitle text,
  isbn_10 text,
  isbn_13 text,
  publisher text,
  publication_date text,
  language_code text,
  cover_asset_id uuid references public.media_assets(id) on delete set null,
  metadata_status text not null default 'source_only' check (metadata_status in ('catalog_matched', 'high_confidence_partial', 'source_only', 'unresolved')),
  metadata_confidence numeric(5,4),
  metadata_provenance jsonb not null default '{}'::jsonb,
  import_state text not null default 'pending' check (import_state in ('complete', 'incomplete', 'pending', 'failed')),
  imported_at timestamptz,
  import_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.topics (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  description text,
  taxonomy_version text not null,
  editorial_state text not null default 'suggested' check (editorial_state in ('suggested', 'approved', 'rejected'))
);

create table public.relationship_types (
  id uuid primary key,
  key text not null unique,
  label text not null,
  inverse_label text,
  description text
);

create table public.relationships (
  id uuid primary key,
  from_entity_id uuid not null references public.entities(id) on delete cascade,
  relationship_type_id uuid not null references public.relationship_types(id) on delete restrict,
  to_entity_id uuid not null references public.entities(id) on delete cascade,
  confidence numeric(5,4),
  rank integer,
  context jsonb not null default '{}'::jsonb,
  editorial_state text not null default 'suggested' check (editorial_state in ('suggested', 'approved', 'rejected')),
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  unique (from_entity_id, relationship_type_id, to_entity_id)
);

create table public.sources (
  id uuid primary key,
  kind text not null check (kind in ('bookshelf_page', 'google_doc', 'external_catalog', 'manual')),
  external_id text,
  canonical_url text,
  title text,
  access_state text not null default 'available' check (access_state in ('available', 'viewer_required', 'missing', 'broken')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, external_id)
);

create table public.source_versions (
  id uuid primary key,
  source_id uuid not null references public.sources(id) on delete cascade,
  content_hash text not null,
  export_format text,
  parser_version text,
  captured_at timestamptz not null,
  raw_snapshot_path text,
  source_metadata jsonb not null default '{}'::jsonb,
  unique (source_id, content_hash)
);

create table public.source_fragments (
  id uuid primary key,
  source_version_id uuid not null references public.source_versions(id) on delete cascade,
  fragment_key text not null,
  ordinal integer not null,
  raw_text text not null,
  normalized_text text,
  paragraph_start integer,
  paragraph_end integer,
  body_block_start integer,
  body_block_end integer,
  container text,
  formatting jsonb not null default '{}'::jsonb,
  unique (source_version_id, fragment_key)
);

create table public.highlights (
  entity_id uuid primary key references public.entities(id) on delete cascade,
  book_id uuid not null references public.books(entity_id) on delete cascade,
  source_fragment_id uuid not null references public.source_fragments(id) on delete restrict,
  source_unit_key text not null unique,
  ordinal integer not null,
  text text not null,
  content_kind text not null check (content_kind in ('highlight', 'chapter_label', 'section_label', 'locator', 'summary', 'note', 'list_item', 'exercise', 'worksheet_element', 'unknown', 'possible_personal_summary')),
  section_path jsonb not null default '[]'::jsonb,
  locator jsonb,
  classification_confidence numeric(5,4) not null,
  classification_reason text,
  review_state text not null default 'unreviewed' check (review_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  public_eligible boolean not null default true,
  standout_rank smallint check (standout_rank between 1 and 3),
  imported_at timestamptz not null,
  import_version text not null,
  check (content_kind <> 'possible_personal_summary' or public_eligible = false)
);

create unique index highlights_book_ordinal_idx on public.highlights(book_id, ordinal);
create unique index highlights_book_standout_idx on public.highlights(book_id, standout_rank) where standout_rank is not null;
create index highlights_book_public_idx on public.highlights(book_id, public_eligible, ordinal);

create table public.external_links (
  id uuid primary key,
  entity_id uuid not null references public.entities(id) on delete cascade,
  link_type text not null check (link_type in ('source_highlights', 'retail_reference', 'book_information', 'provider_record', 'author_site')),
  url text not null,
  label text,
  is_original_source boolean not null default false,
  validation_state text not null default 'unreviewed' check (validation_state in ('valid', 'malformed', 'broken', 'unreviewed')),
  provenance jsonb not null default '{}'::jsonb,
  unique (entity_id, link_type, url)
);

create table public.entity_dates (
  id uuid primary key,
  entity_id uuid not null references public.entities(id) on delete cascade,
  date_type text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  precision text,
  provenance jsonb not null default '{}'::jsonb
);

create table public.provenance_links (
  id uuid primary key,
  entity_id uuid references public.entities(id) on delete cascade,
  relationship_id uuid references public.relationships(id) on delete cascade,
  source_fragment_id uuid references public.source_fragments(id) on delete cascade,
  source_version_id uuid references public.source_versions(id) on delete cascade,
  role text not null,
  confidence numeric(5,4),
  context jsonb not null default '{}'::jsonb,
  check (num_nonnulls(entity_id, relationship_id) = 1),
  check (num_nonnulls(source_fragment_id, source_version_id) >= 1)
);

create table public.ingestion_runs (
  id uuid primary key,
  pipeline_name text not null,
  pipeline_version text not null,
  source_inventory_hash text not null,
  status text not null check (status in ('running', 'complete', 'partial', 'failed')),
  started_at timestamptz not null,
  completed_at timestamptz,
  counts jsonb not null default '{}'::jsonb,
  environment text not null default 'development',
  unique (pipeline_name, pipeline_version, source_inventory_hash)
);

create table public.ingestion_issues (
  id uuid primary key,
  ingestion_run_id uuid not null references public.ingestion_runs(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade,
  source_id uuid references public.sources(id) on delete cascade,
  issue_type text not null,
  severity text not null check (severity in ('info', 'warning', 'error')),
  status text not null default 'open' check (status in ('open', 'resolved', 'accepted')),
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ingestion_run_id, issue_type, entity_id, source_id, message)
);

create trigger entities_updated_at before update on public.entities for each row execute function public.brain_set_updated_at();
create trigger books_updated_at before update on public.books for each row execute function public.brain_set_updated_at();
create trigger media_assets_updated_at before update on public.media_assets for each row execute function public.brain_set_updated_at();
create trigger sources_updated_at before update on public.sources for each row execute function public.brain_set_updated_at();

create index entities_kind_visibility_idx on public.entities(kind, visibility, lifecycle_state);
create index relationships_from_idx on public.relationships(from_entity_id, relationship_type_id);
create index relationships_to_idx on public.relationships(to_entity_id, relationship_type_id);
create index source_fragments_version_ordinal_idx on public.source_fragments(source_version_id, ordinal);
create index ingestion_issues_status_idx on public.ingestion_issues(status, severity);

alter table public.entities enable row level security;
alter table public.people enable row level security;
alter table public.media_assets enable row level security;
alter table public.books enable row level security;
alter table public.topics enable row level security;
alter table public.relationship_types enable row level security;
alter table public.relationships enable row level security;
alter table public.sources enable row level security;
alter table public.source_versions enable row level security;
alter table public.source_fragments enable row level security;
alter table public.highlights enable row level security;
alter table public.external_links enable row level security;
alter table public.entity_dates enable row level security;
alter table public.provenance_links enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.ingestion_issues enable row level security;

create or replace view public.brain_public_books
with (security_barrier = true)
as
select
  e.id,
  e.slug,
  e.title,
  e.summary,
  b.subtitle,
  b.original_title,
  b.original_author,
  b.isbn_10,
  b.isbn_13,
  b.source_position,
  b.metadata_status,
  b.import_state,
  m.storage_path as cover_path,
  m.source_url as cover_source_url,
  m.provider as cover_provider,
  m.provider_identifier as cover_provider_id,
  m.width as cover_width,
  m.height as cover_height
from public.entities e
join public.books b on b.entity_id = e.id
left join public.media_assets m on m.id = b.cover_asset_id and m.editorial_state <> 'rejected'
where e.kind = 'book' and e.visibility = 'public' and e.lifecycle_state <> 'archived';

create or replace view public.brain_public_highlights
with (security_barrier = true)
as
select
  h.entity_id as id,
  h.book_id,
  h.source_unit_key,
  h.ordinal,
  h.text,
  h.content_kind,
  h.section_path,
  h.locator,
  h.standout_rank,
  h.classification_confidence
from public.highlights h
join public.entities e on e.id = h.entity_id
where h.public_eligible = true
  and h.content_kind in ('highlight', 'chapter_label', 'section_label', 'summary', 'note', 'list_item', 'exercise')
  and e.visibility = 'public';

grant usage on schema public to anon, authenticated, service_role;
grant select on public.brain_public_books, public.brain_public_highlights to anon, authenticated;
grant all on public.entities, public.people, public.media_assets, public.books, public.topics,
  public.relationship_types, public.relationships, public.sources, public.source_versions,
  public.source_fragments, public.highlights, public.external_links, public.entity_dates,
  public.provenance_links, public.ingestion_runs, public.ingestion_issues to service_role;

comment on table public.highlights is 'Ordered imported content units. possible_personal_summary rows are retained but never public_eligible until an explicit editorial decision changes their kind.';
comment on table public.ingestion_runs is 'Stable inventory hash plus pipeline version makes the import idempotent and auditable.';
