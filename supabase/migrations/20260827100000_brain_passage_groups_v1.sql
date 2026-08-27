-- Non-destructive display grouping for adjacent Books source units.
-- Source fragments and highlights remain immutable and independently traceable.

create table public.passage_groups (
  id uuid primary key,
  book_id uuid not null references public.books(entity_id) on delete cascade,
  ordinal integer not null,
  grouping_method text not null check (grouping_method in ('structural', 'conservative_rules_v1', 'manual')),
  confidence numeric(5,4),
  review_state text not null default 'unreviewed' check (review_state in ('unreviewed', 'needs_review', 'approved', 'rejected')),
  rationale text,
  import_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, ordinal)
);

create table public.passage_group_members (
  passage_group_id uuid not null references public.passage_groups(id) on delete cascade,
  highlight_id uuid not null references public.highlights(entity_id) on delete cascade,
  ordinal integer not null,
  source_unit_key text not null,
  primary key (passage_group_id, highlight_id),
  unique (passage_group_id, ordinal),
  unique (highlight_id)
);

create index passage_groups_book_idx on public.passage_groups(book_id, ordinal);
create index passage_group_members_unit_idx on public.passage_group_members(source_unit_key);

create trigger passage_groups_updated_at
before update on public.passage_groups
for each row execute function public.brain_set_updated_at();

alter table public.passage_groups enable row level security;
alter table public.passage_group_members enable row level security;

create or replace view public.brain_public_passage_groups
with (security_barrier = true)
as
select
  pg.id,
  pg.book_id,
  pg.ordinal,
  pg.grouping_method,
  pg.confidence,
  pgm.highlight_id,
  pgm.ordinal as member_ordinal,
  pgm.source_unit_key
from public.passage_groups pg
join public.passage_group_members pgm on pgm.passage_group_id = pg.id
join public.highlights h on h.entity_id = pgm.highlight_id
join public.entities e on e.id = h.entity_id
where h.public_eligible = true
  and h.content_kind in ('highlight', 'chapter_label', 'section_label', 'summary', 'note', 'list_item', 'exercise')
  and e.visibility = 'public';

create or replace view public.brain_public_book_authors
with (security_barrier = true)
as
select
  r.from_entity_id as book_id,
  p.display_name,
  r.rank
from public.relationships r
join public.relationship_types rt on rt.id = r.relationship_type_id and rt.key = 'authored_by'
join public.people p on p.entity_id = r.to_entity_id
join public.entities book on book.id = r.from_entity_id
where book.kind = 'book' and book.visibility = 'public' and book.lifecycle_state <> 'archived';

create or replace view public.brain_public_book_topics
with (security_barrier = true)
as
select
  r.from_entity_id as book_id,
  regexp_replace(topic.slug, '^topic-', '') as slug,
  topic.title as label,
  r.confidence,
  r.editorial_state,
  r.rank
from public.relationships r
join public.relationship_types rt on rt.id = r.relationship_type_id and rt.key = 'about_topic'
join public.entities topic on topic.id = r.to_entity_id and topic.kind = 'topic'
join public.entities book on book.id = r.from_entity_id
where book.kind = 'book' and book.visibility = 'public' and book.lifecycle_state <> 'archived';

create or replace view public.brain_public_book_links
with (security_barrier = true)
as
select l.entity_id as book_id, l.link_type, l.url, l.label, l.is_original_source
from public.external_links l
join public.entities book on book.id = l.entity_id
where book.kind = 'book'
  and book.visibility = 'public'
  and l.validation_state <> 'malformed'
  and l.link_type in ('source_highlights', 'retail_reference', 'book_information', 'provider_record', 'author_site');

create or replace view public.brain_public_related_books
with (security_barrier = true)
as
select
  r.from_entity_id as book_id,
  r.to_entity_id as related_book_id,
  related.slug as related_slug,
  r.confidence,
  r.rank
from public.relationships r
join public.relationship_types rt on rt.id = r.relationship_type_id and rt.key = 'related_to'
join public.entities book on book.id = r.from_entity_id
join public.entities related on related.id = r.to_entity_id
where book.kind = 'book' and book.visibility = 'public' and book.lifecycle_state <> 'archived'
  and related.kind = 'book' and related.visibility = 'public' and related.lifecycle_state <> 'archived'
  and r.editorial_state <> 'rejected';

grant select on public.brain_public_passage_groups, public.brain_public_book_authors,
  public.brain_public_book_topics, public.brain_public_book_links,
  public.brain_public_related_books to anon, authenticated;
grant all on public.passage_groups, public.passage_group_members to service_role;

comment on table public.passage_groups is 'Presentation-only grouping of adjacent content units; never replaces or merges source fragments/highlights.';
