-- Re-categorise known coffee chains that landed in the wrong category at
-- seed time. Closes #81. Reads from the 2026-05-08 audit (#79).
--
-- WHEN TO RUN
-- ===========
-- Once after this script lands, then again after any new OSM seed pass.
-- Idempotent — re-running on already-fixed data updates 0 rows.
--
-- WHY
-- ===
-- OSM tags coffee chains inconsistently — Pret a Manger and Dunkin' in
-- Paris arrive as `amenity=fast_food` and the seed maps amenity → category
-- 1:1, so they land as `fast_food` and disappear from the cafés-only
-- default view (#77). Same pattern would hit Costa / Caffè Nero / Tim
-- Hortons in cities with similar OSM gaps. The audit (#79) confirmed
-- only Pret (22 rows) + Dunkin' (3 rows) need fixing today, but the full
-- chain list is included for forward compatibility — extra brands in the
-- list with no matching rows just no-op.
--
-- HOW TO RUN
-- ==========
-- 1. Supabase Dashboard → SQL Editor → New query.
-- 2. Paste the entire file. Run.
-- 3. Verify:
--      select count(*) from public.places
--        where lower(brand) in ('pret a manger', 'pret', 'dunkin''', 'dunkin')
--          and category <> 'cafe';
--    Should return 0.
-- 4. Refresh the materialized view so the cafe-default override picks
--    these places up:
--      refresh materialized view concurrently public.mv_place_ratings;
--    (The UPDATE below issues this automatically.)

set search_path = public, extensions;

with chain_targets(brand_norm, target_category) as (values
  -- Coffee-first chains that often land in the wrong category at seed time.
  -- Source: lib/brand-logos.ts coffee subset + audit #79 findings.
  ('starbucks',           'cafe'::place_category),
  ('starbucks coffee',    'cafe'::place_category),
  ('costa',               'cafe'::place_category),
  ('costa coffee',        'cafe'::place_category),
  ('tim hortons',         'cafe'::place_category),
  ('tims',                'cafe'::place_category),
  ('second cup',          'cafe'::place_category),
  ('caffè nero',          'cafe'::place_category),
  ('caffe nero',          'cafe'::place_category),
  ('pret a manger',       'cafe'::place_category),
  ('pret',                'cafe'::place_category),
  ('dunkin''',            'cafe'::place_category),
  ('dunkin',              'cafe'::place_category),
  ('blue bottle coffee',  'cafe'::place_category),
  ('blue bottle',         'cafe'::place_category),
  ('columbus café',       'cafe'::place_category),
  ('columbus cafe',       'cafe'::place_category),
  ('le pain quotidien',   'cafe'::place_category),
  ('terres de café',      'cafe'::place_category),
  ('terres de cafe',      'cafe'::place_category),
  ('boxcar social',       'cafe'::place_category),
  ('de mello coffee',     'cafe'::place_category),
  ('balzac''s coffee roasters', 'cafe'::place_category),
  ('balzacs',             'cafe'::place_category),
  ('pilot coffee',        'cafe'::place_category),
  ('pilot coffee te aro', 'cafe'::place_category),
  ('fahrenheit coffee',   'cafe'::place_category),
  ('sam james coffee bar','cafe'::place_category),
  ('aroma espresso bar',  'cafe'::place_category)
),
updated as (
  update public.places p
  set category = ct.target_category
  from chain_targets ct
  where lower(p.brand) = ct.brand_norm
    and p.category in ('fast_food', 'restaurant', 'other')
    and p.category <> ct.target_category
  returning p.id, p.name, p.brand, p.city
)
select count(*) as rows_updated,
       array_agg(distinct lower(brand) order by lower(brand)) as brands_touched
from updated;

-- Refresh the per-place rating MV so any place lifted into 'cafe' starts
-- contributing to the cafés-only default view immediately.
refresh materialized view concurrently public.mv_place_ratings;
