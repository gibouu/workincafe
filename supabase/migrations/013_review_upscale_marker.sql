-- Marker column for the legacy 1–5 → 1–10 rating upscale procedure.
-- See #24.
--
-- Migration 005_review_v2.sql widened the rating constraints from 1..5 to
-- 1..10 but left existing rows untouched — they sit in the lower half of
-- the new range, so means computed across the cutover are approximate.
--
-- This migration only adds the marker column. The actual upscale UPDATE
-- ships as a separately-runnable SQL template in
-- `supabase/scripts/upscale-legacy-ratings.sql` so the operator can pick a
-- cutover date and run it once when (if) the smoothing in mv_place_ratings
-- stops absorbing the drift.
--
-- Idempotent.

alter table public.reviews
  add column if not exists upscaled_at timestamptz;

comment on column public.reviews.upscaled_at is
  'Timestamp the row was upscaled from the 1–5 to 1–10 scale. NULL = not upscaled. The presence of this marker is the guard against double-upscaling — see supabase/scripts/upscale-legacy-ratings.sql.';

create index if not exists reviews_upscaled_at_null_idx
  on public.reviews (upscaled_at)
  where upscaled_at is null;
