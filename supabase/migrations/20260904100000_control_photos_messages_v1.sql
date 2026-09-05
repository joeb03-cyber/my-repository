-- Consolidation phase: private photo intake and editable, source-grounded Messages.
-- This migration is prepared for the isolated staging Brain only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brain-photo-originals', 'brain-photo-originals', false, 41943040,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists brain_admin_photo_original_insert on storage.objects;
create policy brain_admin_photo_original_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brain-photo-originals' and name like 'control-center/%' and public.is_brain_admin());
drop policy if exists brain_admin_photo_original_select on storage.objects;
create policy brain_admin_photo_original_select on storage.objects for select to authenticated
  using (bucket_id = 'brain-photo-originals' and name like 'control-center/%' and public.is_brain_admin());
drop policy if exists brain_admin_public_photo_insert on storage.objects;
create policy brain_admin_public_photo_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brain-public-media' and name like 'photos/control-center/%' and public.is_brain_admin());
drop policy if exists brain_admin_public_photo_update on storage.objects;
create policy brain_admin_public_photo_update on storage.objects for update to authenticated
  using (bucket_id = 'brain-public-media' and name like 'photos/control-center/%' and public.is_brain_admin())
  with check (bucket_id = 'brain-public-media' and name like 'photos/control-center/%' and public.is_brain_admin());

drop policy if exists brain_admin_photo_media on public.media_assets;
create policy brain_admin_photo_media on public.media_assets for all to authenticated
  using (public.is_brain_admin() and kind = 'image')
  with check (public.is_brain_admin() and kind = 'image');
drop policy if exists brain_admin_photo_private_metadata on public.photo_private_metadata;
create policy brain_admin_photo_private_metadata on public.photo_private_metadata for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_photo_derivatives on public.photo_derivatives;
create policy brain_admin_photo_derivatives on public.photo_derivatives for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

grant select, insert, update on public.photo_assets, public.photo_private_metadata,
  public.photo_publications, public.photo_derivatives, public.photo_visit_relationships to authenticated;
grant delete on public.photo_visit_relationships to authenticated;

create table if not exists public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  person_name text not null,
  initials text not null,
  identity text not null default '',
  preview text not null default '',
  accent text not null default '#6f7f91',
  person_entity_id uuid references public.entities(id) on delete set null,
  publication_state text not null default 'draft' check (publication_state in ('draft','published','archived')),
  visibility text not null default 'private' check (visibility in ('public','private')),
  editorial_state text not null default 'needs_review' check (editorial_state in ('needs_review','approved','rejected')),
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  speaker_role text not null check (speaker_role in ('joe','guest')),
  body text not null,
  sort_order integer not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, sort_order)
);

create table if not exists public.conversation_message_sources (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.conversation_messages(id) on delete cascade,
  label text not null,
  url text not null,
  source_kind text not null check (source_kind in ('book','interview','article','podcast','research')),
  sort_order integer not null default 100,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists conversation_messages_order_idx on public.conversation_messages(conversation_id, sort_order);
create index if not exists conversation_sources_order_idx on public.conversation_message_sources(message_id, sort_order);
drop trigger if exists message_conversations_updated_at on public.message_conversations;
create trigger message_conversations_updated_at before update on public.message_conversations
  for each row execute function public.brain_set_updated_at();
drop trigger if exists conversation_messages_updated_at on public.conversation_messages;
create trigger conversation_messages_updated_at before update on public.conversation_messages
  for each row execute function public.brain_set_updated_at();

alter table public.message_conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_message_sources enable row level security;
create policy brain_admin_message_conversations on public.message_conversations for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
create policy brain_admin_conversation_messages on public.conversation_messages for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());
create policy brain_admin_conversation_sources on public.conversation_message_sources for all to authenticated
  using (public.is_brain_admin()) with check (public.is_brain_admin());

revoke all on public.message_conversations, public.conversation_messages, public.conversation_message_sources from anon;
grant select, insert, update, delete on public.message_conversations, public.conversation_messages, public.conversation_message_sources to authenticated;
grant all on public.message_conversations, public.conversation_messages, public.conversation_message_sources to service_role;

create or replace view public.brain_public_message_conversations with (security_barrier = true) as
select id, slug, title, person_name, initials, identity, preview, accent, sort_order
from public.message_conversations
where publication_state = 'published' and visibility = 'public' and editorial_state = 'approved';

create or replace view public.brain_public_conversation_messages with (security_barrier = true) as
select m.id, m.conversation_id, m.speaker_role, m.body, m.sort_order
from public.conversation_messages m
join public.message_conversations c on c.id = m.conversation_id
where c.publication_state = 'published' and c.visibility = 'public' and c.editorial_state = 'approved';

create or replace view public.brain_public_conversation_sources with (security_barrier = true) as
select s.id, s.message_id, s.label, s.url, s.source_kind, s.sort_order
from public.conversation_message_sources s
join public.conversation_messages m on m.id = s.message_id
join public.message_conversations c on c.id = m.conversation_id
where c.publication_state = 'published' and c.visibility = 'public' and c.editorial_state = 'approved';

grant select on public.brain_public_message_conversations,
  public.brain_public_conversation_messages, public.brain_public_conversation_sources to anon, authenticated;

comment on table public.photo_private_metadata is 'Private originals, exact GPS, and retained EXIF. Never projected publicly.';
comment on table public.message_conversations is 'Editorial model for explicitly simulated, source-grounded conversations.';
