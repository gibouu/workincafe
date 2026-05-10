-- Link cafés inside hotels to their parent (#115).
--
-- WHEN TO RUN
-- ===========
-- Once after migration 023 lands, then again after every fresh OSM seed
-- pass. Idempotent — re-running on already-linked rows updates 0 rows.
--
-- WHY
-- ===
-- OSM tags hotel-lobby cafés as separate `amenity=cafe` POIs at roughly
-- the same coordinates as the hotel. They already render as cafés on
-- the map, but the relationship to the parent hotel is invisible.
-- This sweep populates `places.parent_place_id` so the place card can
-- show "Inside The Hoxton Hotel" and future surfaces (lobby filters,
-- mall food-courts, gym cafés) can use the same column.
--
-- THRESHOLD
-- =========
-- 15 metres. Tighter than the 30/50m bands we tested — keeps us to
-- "almost certainly inside the building" rather than "next door".
-- Haversine via small-distance approximation; accurate to ~0.1m at
-- city latitudes.
--
-- HOW TO RUN
-- ==========
-- 1. Supabase Dashboard → SQL Editor → New query.
-- 2. Paste the entire file. Run.
-- 3. Verify:
--      select count(*) from public.places where parent_place_id is not null;

set search_path = public, extensions;

with cafe_to_hotel as (
  select c.id as cafe_id, h.id as hotel_id,
         row_number() over (
           partition by c.id
           order by 111320 * sqrt(
             power((c.lat - h.lat), 2) +
             power((c.lng - h.lng) * cos(radians((c.lat + h.lat)/2)), 2)
           )
         ) as rank
  from public.places c
  join public.places h
    on h.category = 'hotel'
   and c.id <> h.id
   and c.lat between h.lat - 0.0005 and h.lat + 0.0005
   and c.lng between h.lng - 0.0007 and h.lng + 0.0007
  where c.category = 'cafe'
    and 111320 * sqrt(
      power((c.lat - h.lat), 2) +
      power((c.lng - h.lng) * cos(radians((c.lat + h.lat)/2)), 2)
    ) < 15
),
linked as (
  update public.places p
     set parent_place_id = th.hotel_id
    from cafe_to_hotel th
   where th.rank = 1
     and p.id = th.cafe_id
     and (p.parent_place_id is null or p.parent_place_id <> th.hotel_id)
  returning p.id
)
select count(*) as cafes_linked from linked;

-- Reclassify the 3 fast_food_burger Dunkin' rows that were missed by
-- the earlier coffee-chain sweep (which only targeted fast_food /
-- restaurant / other categories). The split-fast-food migration moved
-- them to fast_food_burger before that sweep ran.
with reclassed as (
  update public.places
     set category = 'cafe'
   where category = 'fast_food_burger'
     and lower(brand) in ('dunkin''', 'dunkin', 'dunkin donuts',
                          'tim hortons', 'tims',
                          'pret a manger', 'pret')
  returning id
)
select count(*) as fast_food_burger_to_cafe from reclassed;

-- Refresh the rating MV so any reclassified row contributes to the
-- cafés-only default view immediately.
refresh materialized view concurrently public.mv_place_ratings;
