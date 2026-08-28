-- Browser links are an explicit editorial projection. Some legacy public Books
-- and Contacts predate the shared entity editorial-state normalization, so the
-- relationship itself is the approval boundary while visibility remains public.
create or replace view public.brain_public_rabbit_hole_entities
with (security_barrier=true)
as
select l.rabbit_hole_id,e.id entity_id,e.slug entity_slug,e.title entity_title,e.kind entity_kind,l.label,l.public_role,l.sort_order
from public.rabbit_hole_entity_links l
join public.rabbit_holes h on h.id=l.rabbit_hole_id
join public.entities e on e.id=l.entity_id
where h.publication_state='published'
  and h.visibility='public'
  and h.editorial_state='approved'
  and e.visibility='public'
  and e.lifecycle_state='active'
order by l.rabbit_hole_id,l.sort_order;

grant select on public.brain_public_rabbit_hole_entities to anon,authenticated;
