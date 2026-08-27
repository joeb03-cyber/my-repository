-- Keep Library index reads compact while preserving the public-content policy.

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
  m.height as cover_height,
  (
    select count(*)::integer
    from public.highlights h
    where h.book_id = b.entity_id
      and h.public_eligible = true
      and h.content_kind in ('highlight', 'summary', 'note', 'list_item', 'exercise')
  ) as highlight_count
from public.entities e
join public.books b on b.entity_id = e.id
left join public.media_assets m on m.id = b.cover_asset_id and m.editorial_state <> 'rejected'
where e.kind = 'book' and e.visibility = 'public' and e.lifecycle_state <> 'archived';

grant select on public.brain_public_books to anon, authenticated;
