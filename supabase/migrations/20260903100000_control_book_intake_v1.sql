-- Stage 4.3: private, low-friction book intake from Control Center.
-- Highlights instructions remain private; accepted books use the existing public Books model.

create table if not exists public.book_intake_requests (
  id uuid primary key default gen_random_uuid(),
  book_entity_id uuid references public.books(entity_id) on delete set null,
  title text not null,
  author text,
  highlights_reference text,
  metadata_status text not null default 'pending' check (metadata_status in ('pending', 'matched', 'needs_review', 'source_only')),
  cover_status text not null default 'pending' check (cover_status in ('pending', 'cached', 'placeholder', 'needs_review')),
  highlights_status text not null default 'not_provided' check (highlights_status in ('not_provided', 'queued', 'imported', 'inaccessible', 'needs_review')),
  created_by uuid not null references auth.users(id) on delete restrict,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists book_intake_requests_book_idx on public.book_intake_requests(book_entity_id);
create index if not exists book_intake_requests_status_idx on public.book_intake_requests(highlights_status, created_at desc);
drop trigger if exists book_intake_requests_updated_at on public.book_intake_requests;
create trigger book_intake_requests_updated_at before update on public.book_intake_requests for each row execute function public.brain_set_updated_at();
alter table public.book_intake_requests enable row level security;
drop policy if exists brain_admin_book_intake on public.book_intake_requests;
create policy brain_admin_book_intake on public.book_intake_requests for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin() and created_by = auth.uid());

drop policy if exists brain_admin_book_entities on public.entities;
create policy brain_admin_book_entities on public.entities for all to authenticated using (public.is_brain_admin() and kind in ('book', 'person')) with check (public.is_brain_admin() and kind in ('book', 'person'));
drop policy if exists brain_admin_book_people on public.people;
create policy brain_admin_book_people on public.people for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_books on public.books;
create policy brain_admin_books on public.books for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_book_media on public.media_assets;
create policy brain_admin_book_media on public.media_assets for all to authenticated using (public.is_brain_admin() and kind = 'book_cover') with check (public.is_brain_admin() and kind = 'book_cover');
drop policy if exists brain_admin_book_relationships on public.relationships;
create policy brain_admin_book_relationships on public.relationships for all to authenticated using (public.is_brain_admin()) with check (public.is_brain_admin());
drop policy if exists brain_admin_relationship_types_read on public.relationship_types;
create policy brain_admin_relationship_types_read on public.relationship_types for select to authenticated using (public.is_brain_admin());

grant select, insert, update on public.book_intake_requests, public.books, public.people, public.media_assets, public.relationships to authenticated;
grant select on public.relationship_types to authenticated;
grant delete on public.book_intake_requests to authenticated;
grant all on public.book_intake_requests to service_role;

-- The existing public-media bucket began with photo-oriented WebP only. Book
-- catalog providers may return JPEG or PNG covers, so allow those image types.
update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'video/quicktime', 'video/mp4']::text[]
where id = 'brain-public-media';

drop policy if exists brain_admin_control_book_cover_insert on storage.objects;
create policy brain_admin_control_book_cover_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'brain-public-media' and name like 'book-covers/control-center/%' and public.is_brain_admin());
drop policy if exists brain_admin_control_book_cover_update on storage.objects;
create policy brain_admin_control_book_cover_update on storage.objects for update to authenticated
  using (bucket_id = 'brain-public-media' and name like 'book-covers/control-center/%' and public.is_brain_admin())
  with check (bucket_id = 'brain-public-media' and name like 'book-covers/control-center/%' and public.is_brain_admin());

comment on table public.book_intake_requests is 'Private instructions and review state for books added through Control Center. Not exposed by any public view.';
