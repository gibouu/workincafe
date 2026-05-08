-- Split existing `category='fast_food'` rows into:
--   - fast_food_burger : burger / fried-chicken / pizza / sub / dessert /
--                        food-court chains (default; hidden in cafés-only).
--   - restaurant       : fast-casual chains where people actually work
--                        (Chipotle, Pret a Manger, Freshii, Cojean…).
-- See #80. Reads from #79's audit (docs/category-audit-2026-05.md).
--
-- WHEN TO RUN
-- ===========
-- After migration `020_fast_food_burger.sql` adds the enum value.
-- Operator-runnable from Supabase Dashboard → SQL Editor. Idempotent —
-- re-running on already-split data updates 0 rows.
--
-- KEEP IN SYNC
-- ============
-- The two `(values …)` clauses below mirror
-- `lib/places/fast-food-buckets.ts`. If you add a brand there, mirror it
-- here. The TS file drives the seed (`scripts/seed-osm.ts`) for new rows;
-- this script handles the existing 18,325-row snapshot.
--
-- HOW TO RUN
-- ==========
-- 1. Apply migration 020 first.
-- 2. Supabase Dashboard → SQL Editor → New query.
-- 3. Paste this entire file. Run.
-- 4. Confirm via:
--      select category, count(*) from public.places
--        where lower(brand) = 'mcdonald''s' group by category;
--    — should show all McDonald's rows under `fast_food_burger`.
-- 5. Re-run script: returns 0 rows updated (idempotent).

set search_path = public, extensions;

-- 1) Move fast-casual brands → restaurant first.
--    Doing fast-casual before burger means brands listed in BOTH (none
--    today, but defends against a future typo) end up as restaurant —
--    the safer side, since the chip is visible by default behind the
--    restaurant filter.
with fast_casual_brands(b) as (values
  ('chipotle'),
  ('freshii'),
  ('pita pit'),
  ('exki'),
  ('cojean'),
  ('poke house'),
  ('pokawa'),
  ('oakberry açaí bowls'),
  ('pitaya'),
  ('big fernand'),
  ('côté sushi'),
  ('chamas tacos'),
  ('burrito boyz'),
  ('mucho burrito'),
  ('quesada'),
  ('barburrito'),
  ('tahini''s'),
  ('california sandwiches'),
  ('basil box')
),
moved_to_restaurant as (
  update public.places p
  set category = 'restaurant'
  from fast_casual_brands fc
  where p.category = 'fast_food' and lower(p.brand) = fc.b
  returning 1
)
select count(*) as fast_casual_promoted from moved_to_restaurant;

-- 2) Everything still in `fast_food` after step 1 → fast_food_burger.
--    This catches both the explicit burger list and any unmatched
--    brands (per #80 spec: "default to fast_food_burger — safer for the
--    default-hidden state").
with moved_to_burger as (
  update public.places
  set category = 'fast_food_burger'
  where category = 'fast_food'
  returning 1
)
select count(*) as remaining_into_burger from moved_to_burger;

-- 3) Refresh the per-place rating MV so the UI sees the new categories
--    on the next request.
refresh materialized view concurrently public.mv_place_ratings;
