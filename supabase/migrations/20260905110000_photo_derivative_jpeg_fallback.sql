-- Staging photo intake: current iPhone Safari versions may decode camera
-- photos but only encode an optimized JPEG canvas copy. Public derivatives
-- remain constrained to the two explicitly supported publishing formats.

alter table public.photo_derivatives
  drop constraint if exists photo_derivatives_mime_type_check;

alter table public.photo_derivatives
  add constraint photo_derivatives_mime_type_check
  check (mime_type in ('image/webp', 'image/jpeg'));

update storage.buckets
set allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'brain-public-media';
