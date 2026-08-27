-- Stage 10.5: five-profile Contacts editorial pilot.
-- Apply only to the isolated staging Brain until reviewed.

alter table public.people
  add column if not exists factual_identity_source_url text,
  add column if not exists factual_identity_source_label text,
  add column if not exists factual_identity_retrieved_at date,
  add column if not exists portrait_asset_id uuid references public.media_assets(id) on delete set null;

create table if not exists public.editorial_source_candidates (
  id uuid primary key,
  person_entity_id uuid not null references public.people(entity_id) on delete cascade,
  candidate_kind text not null,
  title text not null,
  external_url text,
  existing_entity_id uuid references public.entities(id) on delete set null,
  existing_source_id uuid references public.sources(id) on delete set null,
  approval_state text not null default 'suggested'
    check (approval_state in ('suggested', 'approved', 'rejected')),
  rank integer,
  editorial_note text,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists editorial_source_candidates_person_idx
  on public.editorial_source_candidates(person_entity_id, approval_state, rank);

drop trigger if exists editorial_source_candidates_updated_at on public.editorial_source_candidates;
create trigger editorial_source_candidates_updated_at before update on public.editorial_source_candidates
  for each row execute function public.brain_set_updated_at();

alter table public.editorial_source_candidates enable row level security;
grant all on public.editorial_source_candidates to service_role;

-- The pilot intentionally replaces the five profiles' broad Stage 10 topic
-- suggestions with one focused, still-reviewable topic each.
update public.relationships relation
set editorial_state = 'rejected',
    context = relation.context || '{"superseded_by":"contacts_editorial_pilot_v1"}'::jsonb
from public.relationship_types relation_type
where relation.relationship_type_id = relation_type.id
  and relation_type.key = 'associated_with'
  and coalesce(relation.context->>'source', '') <> 'contacts_editorial_pilot'
  and relation.from_entity_id in (
    'fb49fab6-4842-5785-b842-81d07a3a1fd8',
    'd654e2cb-80bf-559d-8082-00ee40d35686',
    'f36f1c56-df91-55fe-b16e-38a9bcb4bb36',
    '552d34ad-7dc4-593c-807e-2ba4aad71894',
    '2a23fed0-1b95-54af-8788-2c2e340874a5'
  );

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
  ), '[]'::jsonb) as podcast_appearances,
  case when portrait.id is not null then jsonb_build_object(
    'path', portrait.storage_path,
    'alt', person.display_name,
    'attribution', portrait.provenance->>'attribution',
    'license', portrait.provenance->>'license',
    'sourceUrl', portrait.source_url
  ) else null end as portrait
from public.entities entity
join public.people person on person.entity_id = entity.id
left join public.media_assets portrait on portrait.id = person.portrait_asset_id
  and portrait.kind = 'image' and portrait.editorial_state = 'approved'
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

grant select on public.brain_public_contacts to anon, authenticated;

comment on table public.editorial_source_candidates is
  'Private, reviewable candidate entry points. Suggested rows must not be publicly labeled Start Here until Joe approves them.';
