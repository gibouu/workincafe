-- 010: Move review photos to Cloudinary.
--
-- Adds public_id + version columns. The legacy `path` column is kept for
-- a migration window (existing rows still reference Supabase Storage). A
-- one-shot script copies images to Cloudinary and backfills public_id; once
-- verified, drop the bucket and the `path` column in a follow-up migration.

alter table public.review_photos
  add column if not exists cloudinary_public_id text,
  add column if not exists cloudinary_version  text;

create index if not exists review_photos_cloudinary_idx
  on public.review_photos (cloudinary_public_id)
  where cloudinary_public_id is not null;
