-- One-shot upscale of legacy 1–5 review rows to the 1–10 scale.
-- Closes the data drift mentioned in `005_review_v2.sql`. See #24.
--
-- WHEN TO RUN
-- ===========
-- Only when `mv_place_ratings` averages start to look visibly off because a
-- meaningful share of a place's reviews are still on the legacy 1–5 scale.
-- Until then, the materialised view's smoothing absorbs the drift.
--
-- HOW TO RUN
-- ==========
-- 1. Edit the `legacy_cutover` value below to the timestamp at which the
--    review form switched to the 1–10 scale in production. Anything inserted
--    *before* that timestamp is treated as a 1–5 row.
-- 2. Open Supabase Dashboard → SQL Editor.
-- 3. Run the SELECT ("preview") block first to count what will be touched.
-- 4. If the count looks right, run the UPDATE block.
-- 5. Run the REFRESH at the bottom so `mv_place_ratings` reflects the new
--    values immediately.
--
-- GUARDS
-- ======
-- - `upscaled_at IS NULL` filter prevents double-running. Migration 013
--   added the column.
-- - `LEAST(rating * 2, 10)` caps in case any legacy row already stored a 5
--   (which would multiply to 10 cleanly anyway, but the cap is defensive).
-- - Wrapped in a transaction; the operator can ROLLBACK after previewing
--   row counts.

begin;

-- ---- 1) PREVIEW (read-only) ------------------------------------------------
-- Edit the cutover here. Format: ISO 8601 with timezone.
do $$
declare
  legacy_cutover constant timestamptz := '2026-01-01T00:00:00Z';
  candidate_count int;
begin
  select count(*) into candidate_count
  from public.reviews
  where upscaled_at is null
    and created_at < legacy_cutover;
  raise notice 'upscale candidates: %', candidate_count;
end $$;

-- ---- 2) UPDATE -------------------------------------------------------------
-- Same cutover as above. NULL ratings are left untouched (`x * 2` of NULL is
-- NULL); we set `upscaled_at` for *all* rows in the window so the next run
-- skips them even if no rating columns were populated.
update public.reviews
set
  overall_rating       = least(coalesce(overall_rating       * 2, overall_rating),       10),
  wifi_rating          = least(coalesce(wifi_rating          * 2, wifi_rating),          10),
  noise_rating         = least(coalesce(noise_rating         * 2, noise_rating),         10),
  seating_rating       = least(coalesce(seating_rating       * 2, seating_rating),       10),
  comfort_rating       = least(coalesce(comfort_rating       * 2, comfort_rating),       10),
  outlets_rating       = least(coalesce(outlets_rating       * 2, outlets_rating),       10),
  price_rating         = least(coalesce(price_rating         * 2, price_rating),         10),
  atmosphere_rating    = least(coalesce(atmosphere_rating    * 2, atmosphere_rating),    10),
  food_rating          = least(coalesce(food_rating          * 2, food_rating),          10),
  temperature_rating   = least(coalesce(temperature_rating   * 2, temperature_rating),   10),
  food_value_rating    = least(coalesce(food_value_rating    * 2, food_value_rating),    10),
  current_busyness     = least(coalesce(current_busyness     * 2, current_busyness),     10),
  temperature_feel     = least(coalesce(temperature_feel     * 2, temperature_feel),     10),
  overall_suggested    = least(coalesce(overall_suggested    * 2, overall_suggested),    10),
  upscaled_at          = now()
where upscaled_at is null
  and created_at < '2026-01-01T00:00:00Z';

-- ---- 3) Verify before commit ----------------------------------------------
-- Run a SELECT here in the SQL Editor (without ; on the last line of the
-- transaction) if you want to inspect counts. Then COMMIT or ROLLBACK.

commit;

-- ---- 4) Refresh the materialised view -------------------------------------
refresh materialized view concurrently public.mv_place_ratings;
