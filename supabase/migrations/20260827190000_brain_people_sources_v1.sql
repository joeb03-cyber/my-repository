-- Synergetic Human Brain: People + reusable Sources vertical slice.
-- Apply only to the isolated staging Brain until the model is reviewed.

alter table public.people
  add column if not exists initials text,
  add column if not exists factual_identity text,
  add column if not exists identity_review_state text not null default 'unreviewed'
    check (identity_review_state in ('unreviewed', 'needs_review', 'approved')),
  add column if not exists contact_publication_state text not null default 'hidden'
    check (contact_publication_state in ('hidden', 'published', 'retired'));

alter table public.sources drop constraint if exists sources_kind_check;
alter table public.sources add constraint sources_kind_check check (kind in (
  'bookshelf_page', 'google_doc', 'external_catalog', 'manual',
  'podcast_show', 'podcast_episode', 'article', 'blog_post', 'video_interview',
  'website', 'paper_research', 'newsletter', 'saved_document', 'other'
));
alter table public.sources
  add column if not exists slug text,
  add column if not exists subtitle text,
  add column if not exists container_source_id uuid references public.sources(id) on delete set null,
  add column if not exists publication_date date,
  add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists visibility text not null default 'private'
    check (visibility in ('public', 'private', 'excluded')),
  add column if not exists editorial_state text not null default 'unreviewed'
    check (editorial_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  add column if not exists privacy_state text not null default 'private_source'
    check (privacy_state in ('private_source', 'public_metadata_only', 'public_source')),
  add column if not exists public_provenance_label text,
  add column if not exists provenance jsonb not null default '{}'::jsonb;

create unique index if not exists sources_slug_unique_idx on public.sources(slug) where slug is not null;
create index if not exists sources_container_idx on public.sources(container_source_id);

create table if not exists public.person_aliases (
  id uuid primary key,
  person_entity_id uuid not null references public.people(entity_id) on delete cascade,
  value text not null,
  alias_kind text not null default 'source_supplied'
    check (alias_kind in ('source_supplied', 'alternate_name', 'spelling_correction', 'honorific_form')),
  review_state text not null default 'unreviewed'
    check (review_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (person_entity_id, value)
);

create table if not exists public.source_people (
  id uuid primary key,
  source_id uuid not null references public.sources(id) on delete cascade,
  person_entity_id uuid references public.people(entity_id) on delete set null,
  role text not null check (role in ('host', 'guest', 'author', 'speaker', 'subject', 'creator')),
  credited_name text not null,
  credit_order integer not null default 1,
  confidence numeric(5,4) not null default 1,
  editorial_state text not null default 'approved'
    check (editorial_state in ('suggested', 'approved', 'rejected')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, role, credited_name)
);

create index if not exists source_people_person_idx on public.source_people(person_entity_id, source_id);

create table if not exists public.editorial_assertions (
  id uuid primary key,
  target_entity_id uuid references public.entities(id) on delete cascade,
  target_source_id uuid references public.sources(id) on delete cascade,
  context_entity_id uuid references public.entities(id) on delete cascade,
  assertion_type text not null check (assertion_type in (
    'interesting', 'valuable', 'enlightening', 'useful', 'personally_impactful',
    'good_starting_point', 'favorite', 'tried_personally', 'recommend_exploring', 'high_leverage'
  )),
  approval_state text not null default 'suggested'
    check (approval_state in ('suggested', 'approved', 'rejected', 'revoked', 'superseded')),
  context_domain text,
  note text,
  asserted_by text not null,
  endorsement boolean not null default false,
  visibility text not null default 'private'
    check (visibility in ('public', 'private', 'excluded')),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(target_entity_id, target_source_id) = 1)
);

create unique index if not exists editorial_assertion_identity_idx
  on public.editorial_assertions (
    coalesce(target_entity_id::text, ''), coalesce(target_source_id::text, ''),
    coalesce(context_entity_id::text, ''), assertion_type, asserted_by
  );

drop trigger if exists editorial_assertions_updated_at on public.editorial_assertions;
create trigger editorial_assertions_updated_at before update on public.editorial_assertions
  for each row execute function public.brain_set_updated_at();

alter table public.person_aliases enable row level security;
alter table public.source_people enable row level security;
alter table public.editorial_assertions enable row level security;

grant all on public.person_aliases, public.source_people, public.editorial_assertions to service_role;

insert into public.relationship_types (id, key, label, inverse_label, description) values
  ('72aa0428-73e9-5706-8279-8d7088595194', 'associated_with', 'Associated with', 'Includes person', 'A conservative, provenance-bearing Person to Topic association.'),
  ('4232e3b5-14e0-5633-a62a-c31e8627d6e8', 'person_related_to', 'Related to', 'Related to', 'An evidence-based or editorially approved relationship between People.')
on conflict (key) do update set
  label = excluded.label,
  inverse_label = excluded.inverse_label,
  description = excluded.description;

create or replace view public.brain_public_podcast_episodes
with (security_barrier = true)
as
select
  episode.id,
  episode.slug,
  episode.title,
  show.title as show_title,
  episode.publication_date,
  episode.duration_seconds,
  episode.canonical_url as original_url,
  episode.public_provenance_label,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'role', credit.role,
      'name', credit.credited_name,
      'personId', credit.person_entity_id
    ) order by credit.credit_order, credit.credited_name)
    from public.source_people credit
    where credit.source_id = episode.id and credit.editorial_state = 'approved'
  ), '[]'::jsonb) as credits
from public.sources episode
left join public.sources show on show.id = episode.container_source_id
where episode.kind = 'podcast_episode'
  and episode.visibility = 'public'
  and episode.editorial_state = 'approved'
  and episode.privacy_state = 'public_metadata_only';

create or replace view public.brain_public_contacts
with (security_barrier = true)
as
select
  entity.id,
  entity.slug,
  person.display_name,
  person.sort_name,
  person.initials,
  person.factual_identity,
  true as curated_interest,
  false as endorsement,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'slug', topic_entity.slug,
      'label', topic_entity.title,
      'editorialState', relation.editorial_state
    ) order by relation.rank nulls last, topic_entity.title)
    from public.relationships relation
    join public.relationship_types relation_type on relation_type.id = relation.relationship_type_id
    join public.entities topic_entity on topic_entity.id = relation.to_entity_id
    where relation.from_entity_id = entity.id
      and relation_type.key = 'associated_with'
      and relation.editorial_state in ('suggested', 'approved')
      and topic_entity.kind = 'topic'
      and topic_entity.visibility = 'public'
  ), '[]'::jsonb) as topics,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', book_entity.id,
      'slug', book_entity.slug,
      'title', book_entity.title,
      'originalAuthor', book.original_author,
      'coverPath', cover.storage_path
    ) order by book.source_position)
    from public.relationships relation
    join public.relationship_types relation_type on relation_type.id = relation.relationship_type_id
    join public.entities book_entity on book_entity.id = relation.from_entity_id
    join public.books book on book.entity_id = book_entity.id
    left join public.media_assets cover on cover.id = book.cover_asset_id and cover.editorial_state <> 'rejected'
    where relation.to_entity_id = entity.id
      and relation_type.key = 'authored_by'
      and relation.editorial_state = 'approved'
      and book_entity.visibility = 'public'
  ), '[]'::jsonb) as books,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', episode.id,
      'slug', episode.slug,
      'title', episode.title,
      'showTitle', show.title,
      'role', credit.role,
      'publicationDate', episode.publication_date,
      'durationSeconds', episode.duration_seconds
    ) order by episode.publication_date desc nulls last, episode.title)
    from public.source_people credit
    join public.sources episode on episode.id = credit.source_id
    left join public.sources show on show.id = episode.container_source_id
    where credit.person_entity_id = entity.id
      and credit.editorial_state = 'approved'
      and episode.kind = 'podcast_episode'
      and episode.visibility = 'public'
      and episode.editorial_state = 'approved'
      and episode.privacy_state = 'public_metadata_only'
  ), '[]'::jsonb) as podcast_appearances
from public.entities entity
join public.people person on person.entity_id = entity.id
where entity.kind = 'person'
  and entity.visibility = 'public'
  and entity.lifecycle_state <> 'archived'
  and person.contact_publication_state = 'published'
  and exists (
    select 1 from public.editorial_assertions assertion
    where assertion.target_entity_id = entity.id
      and assertion.assertion_type = 'interesting'
      and assertion.approval_state = 'approved'
      and assertion.asserted_by = 'joe_burt'
      and assertion.endorsement = false
  );

grant select on public.brain_public_contacts, public.brain_public_podcast_episodes to anon, authenticated;

comment on table public.person_aliases is 'Source-supplied spellings and identity aliases. The public Contacts view deliberately omits these provenance records.';
comment on table public.editorial_assertions is 'Contextual, reviewable editorial metadata. Interesting never implies endorsement; high_leverage and good_starting_point are never inferred.';
comment on view public.brain_public_podcast_episodes is 'Public-safe podcast metadata only. No archive body, summary, private locator, or source snapshot is exposed.';
