-- PDF menu support. See #61.
--
-- Cloudinary's image-upload pipeline accepts PDFs (rasterised on
-- delivery), so we use the same `cloudinary_public_id` column for both
-- file kinds. This column is just metadata so the renderer can branch
-- between <Image> and <iframe>.
--
-- Idempotent.

alter table public.place_menus
  add column if not exists file_kind text not null default 'image';

alter table public.place_menus
  drop constraint if exists place_menus_file_kind_check;

alter table public.place_menus
  add constraint place_menus_file_kind_check
  check (file_kind in ('image', 'pdf'));
