-- Focused real-use repair: canonical Recently Read relationships and complete
-- public provenance for Rejection Proof. Isolated staging first.

alter table public.current_state_entity_links
  drop constraint if exists current_state_entity_links_role_check;
alter table public.current_state_entity_links
  add constraint current_state_entity_links_role_check
  check (role in ('reading', 'reading_secondary', 'recently_read', 'recently_read_secondary'));

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
where l.role in ('reading', 'reading_secondary', 'recently_read', 'recently_read_secondary')
  and s.publication_state = 'published'
  and e.kind = 'book'
  and e.visibility = 'public'
  and e.lifecycle_state <> 'archived';

grant select on public.brain_public_current_state_reading to anon, authenticated;

-- These are the two newest completed Library additions preceding the books
-- currently being read. They are reviewable and replaceable in Control Center.
insert into public.current_state_entity_links (snapshot_id, role, entity_id)
select s.id, seed.role, e.id
from public.current_state_snapshots s
cross join (values
  ('recently_read', 'you-can-just-do-things'),
  ('recently_read_secondary', 'what-your-body-wants-you-to-know')
) as seed(role, slug)
join public.entities e on e.slug = seed.slug and e.kind = 'book'
where s.publication_state = 'published'
on conflict (snapshot_id, role) do nothing;

insert into public.external_links
  (id, entity_id, link_type, url, label, is_original_source, validation_state, provenance)
select
  'd242835f-620e-54d7-957c-1e1cae2d8456', e.id, 'provider_record',
  'https://books.google.com/books/about/Rejection_Proof.html?id=NBCPEAAAQBAJ',
  'Google Books record', false, 'valid',
  '{"source":"Google Books metadata match","providerId":"NBCPEAAAQBAJ"}'::jsonb
from public.entities e
where e.kind = 'book' and e.slug = 'rejection-proof'
on conflict (entity_id, link_type, url) do update
set label = excluded.label, validation_state = excluded.validation_state,
    provenance = excluded.provenance;
