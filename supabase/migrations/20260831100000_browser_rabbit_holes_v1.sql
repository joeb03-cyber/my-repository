-- Stage 16: Browser v1. Isolated staging only until explicitly promoted.

create table if not exists public.rabbit_holes (
  id uuid primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  central_question text not null default '',
  short_intro text not null default '',
  current_take text not null default '',
  status text not null default 'open' check (status in ('open','paused','closed')),
  accent text not null default 'ember' check (accent in ('ember','sun','violet','ocean','moss')),
  publication_state text not null default 'draft' check (publication_state in ('draft','published','archived')),
  visibility text not null default 'private' check (visibility in ('public','private')),
  editorial_state text not null default 'needs_review' check (editorial_state in ('needs_review','approved','rejected')),
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rabbit_hole_blocks (
  id uuid primary key,
  rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  block_type text not null check (block_type in ('narrative','experience','question','list','quote')),
  heading text not null default '', body text not null default '', items jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.rabbit_hole_resources (
  id uuid primary key,
  rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  title text not null, url text not null,
  resource_type text not null check (resource_type in ('book','paper','article','podcast','video','website')),
  note text not null default '', public_role text not null check (public_role in ('start_here','keep_going','context')),
  evidence_layer text not null check (evidence_layer in ('experience','practice','model','mechanism','experimental','review')),
  sort_order integer not null default 100, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.rabbit_hole_entity_links (
  rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  label text not null default 'Related', public_role text not null check (public_role in ('person','book','source','note','keep_going')),
  evidence_layer text not null default 'model' check (evidence_layer in ('experience','practice','model','mechanism','experimental','review')),
  sort_order integer not null default 100, provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), primary key (rabbit_hole_id,entity_id,public_role)
);

create table if not exists public.rabbit_hole_links (
  from_rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  to_rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  label text not null default 'Related', sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  primary key (from_rabbit_hole_id,to_rabbit_hole_id)
);

create table if not exists public.rabbit_hole_human_links (
  rabbit_hole_id uuid not null references public.rabbit_holes(id) on delete cascade,
  human_entry_id uuid not null references public.human_entries(id) on delete cascade,
  browser_label text not null default 'How this affects how I live',
  human_label text not null default 'Explore why I think this', sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  primary key (rabbit_hole_id,human_entry_id)
);

do $$ begin
  create trigger rabbit_holes_updated_at before update on public.rabbit_holes for each row execute function public.brain_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger rabbit_hole_blocks_updated_at before update on public.rabbit_hole_blocks for each row execute function public.brain_set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger rabbit_hole_resources_updated_at before update on public.rabbit_hole_resources for each row execute function public.brain_set_updated_at();
exception when duplicate_object then null; end $$;

alter table public.rabbit_holes enable row level security;
alter table public.rabbit_hole_blocks enable row level security;
alter table public.rabbit_hole_resources enable row level security;
alter table public.rabbit_hole_entity_links enable row level security;
alter table public.rabbit_hole_links enable row level security;
alter table public.rabbit_hole_human_links enable row level security;

drop policy if exists brain_admin_rabbit_holes on public.rabbit_holes;
create policy brain_admin_rabbit_holes on public.rabbit_holes for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_rabbit_blocks on public.rabbit_hole_blocks;
create policy brain_admin_rabbit_blocks on public.rabbit_hole_blocks for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_rabbit_resources on public.rabbit_hole_resources;
create policy brain_admin_rabbit_resources on public.rabbit_hole_resources for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_rabbit_entities on public.rabbit_hole_entity_links;
create policy brain_admin_rabbit_entities on public.rabbit_hole_entity_links for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_rabbit_links on public.rabbit_hole_links;
create policy brain_admin_rabbit_links on public.rabbit_hole_links for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_rabbit_human on public.rabbit_hole_human_links;
create policy brain_admin_rabbit_human on public.rabbit_hole_human_links for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select,insert,update,delete on public.rabbit_holes,public.rabbit_hole_blocks,public.rabbit_hole_resources,
  public.rabbit_hole_entity_links,public.rabbit_hole_links,public.rabbit_hole_human_links to authenticated;
grant all on public.rabbit_holes,public.rabbit_hole_blocks,public.rabbit_hole_resources,
  public.rabbit_hole_entity_links,public.rabbit_hole_links,public.rabbit_hole_human_links to service_role;

create or replace view public.brain_public_rabbit_holes with (security_barrier=true) as
select id,slug,title,central_question,short_intro,current_take,status,accent,sort_order,updated_at
from public.rabbit_holes where publication_state='published' and visibility='public' and editorial_state='approved'
order by sort_order,title;
create or replace view public.brain_public_rabbit_hole_blocks with (security_barrier=true) as
select b.id,b.rabbit_hole_id,b.block_type,b.heading,b.body,b.items,b.sort_order
from public.rabbit_hole_blocks b join public.rabbit_holes h on h.id=b.rabbit_hole_id
where h.publication_state='published' and h.visibility='public' and h.editorial_state='approved' order by b.rabbit_hole_id,b.sort_order;
create or replace view public.brain_public_rabbit_hole_resources with (security_barrier=true) as
select r.id,r.rabbit_hole_id,r.title,r.url,r.resource_type,r.note,r.public_role,r.evidence_layer,r.sort_order
from public.rabbit_hole_resources r join public.rabbit_holes h on h.id=r.rabbit_hole_id
where h.publication_state='published' and h.visibility='public' and h.editorial_state='approved' order by r.rabbit_hole_id,r.sort_order;
create or replace view public.brain_public_rabbit_hole_entities with (security_barrier=true) as
select l.rabbit_hole_id,e.id entity_id,e.slug entity_slug,e.title entity_title,e.kind entity_kind,l.label,l.public_role,l.sort_order
from public.rabbit_hole_entity_links l join public.rabbit_holes h on h.id=l.rabbit_hole_id join public.entities e on e.id=l.entity_id
where h.publication_state='published' and h.visibility='public' and h.editorial_state='approved'
and e.visibility='public' and e.lifecycle_state='active' and e.editorial_state='approved' order by l.rabbit_hole_id,l.sort_order;
create or replace view public.brain_public_rabbit_hole_links with (security_barrier=true) as
select l.from_rabbit_hole_id,l.to_rabbit_hole_id,t.slug to_slug,t.title to_title,l.label,
case when t.publication_state='published' and t.visibility='public' and t.editorial_state='approved' then 'published' else 'draft' end to_publication_state,l.sort_order
from public.rabbit_hole_links l join public.rabbit_holes f on f.id=l.from_rabbit_hole_id join public.rabbit_holes t on t.id=l.to_rabbit_hole_id
where f.publication_state='published' and f.visibility='public' and f.editorial_state='approved' order by l.from_rabbit_hole_id,l.sort_order;
create or replace view public.brain_public_rabbit_hole_human_links with (security_barrier=true) as
select l.rabbit_hole_id,h.id human_entry_id,h.slug human_entry_slug,h.title human_entry_title,l.browser_label,l.human_label,l.sort_order
from public.rabbit_hole_human_links l join public.rabbit_holes r on r.id=l.rabbit_hole_id join public.human_entries h on h.id=l.human_entry_id
where r.publication_state='published' and r.visibility='public' and r.editorial_state='approved'
and h.publication_state='published' and h.visibility='public' and h.editorial_state='approved' order by l.rabbit_hole_id,l.sort_order;

grant select on public.brain_public_rabbit_holes,public.brain_public_rabbit_hole_blocks,
  public.brain_public_rabbit_hole_resources,public.brain_public_rabbit_hole_entities,
  public.brain_public_rabbit_hole_links,public.brain_public_rabbit_hole_human_links to anon,authenticated;

comment on table public.rabbit_holes is 'Domain-neutral editorial rabbit holes. Drafts and provenance stay protected.';
comment on view public.brain_public_rabbit_holes is 'Only explicitly published Browser trails; no private research artifacts or provenance.';
