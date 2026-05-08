-- 018: Add `user_rating_count` to mv_place_ratings.
--
-- The default visible state on the map is now narrowed to cafés (#77).
-- Other categories should still surface when a real *user* has reviewed
-- them, which validates them as worth showing regardless of category.
-- This MV column makes that fast — one boolean per place at fetch time.
--
-- Synthetic reviews (Foursquare / Yelp / system imports) don't count;
-- only `source = 'user'` rows. Hidden reviews don't count either.
--
-- Recreates the MV body verbatim from 011_review_provenance.sql and
-- adds the new aggregate. Idempotent.

drop materialized view if exists public.mv_place_ratings cascade;

create materialized view public.mv_place_ratings as
with category_means as (
  select p.category, avg(r.overall_rating)::real as cat_mean
  from public.reviews r
  join public.places p on p.id = r.place_id
  where r.is_hidden = false and r.overall_rating is not null
  group by p.category
),
weighted_reviews as (
  select
    r.id,
    r.place_id,
    r.source,
    p.category,
    r.overall_rating::real    as rating,
    r.wifi_rating,
    r.noise_rating,
    r.seating_rating,
    r.outlets_rating,
    r.price_rating,
    r.atmosphere_rating,
    r.temperature_rating,
    r.food_rating,
    r.is_hidden,
    r.source_weight * least(
      5.0,
      1.0
      + case when r.geo_verified then 0.5 else 0 end
      + 0.3 * coalesce(
          (select 1 from public.wifi_tests w
             where w.user_id = r.user_id
               and w.place_id = r.place_id
               and abs(extract(epoch from w.created_at - r.created_at)) < 600
             limit 1),
          0)
    ) * greatest(0.3, exp(-0.5 * extract(epoch from now() - r.created_at) / (365 * 86400))) as w
  from public.reviews r
  join public.places p on p.id = r.place_id
  where r.overall_rating is not null and r.is_hidden = false
)
select
  wr.place_id,
  (
    (sum(wr.w * wr.rating) / nullif(sum(wr.w), 0))
      * (sum(wr.w) / (sum(wr.w) + 8.0))
    + coalesce(max(cm.cat_mean), 3.5) * (8.0 / (sum(wr.w) + 8.0))
  ) as study_spot_rating,
  count(*) as rating_count,
  count(*) filter (where wr.source = 'user' and wr.is_hidden = false) as user_rating_count,
  -- avg of source='user' ratings only — feeds the rating-threshold gate on the
  -- map's category-filter override. Null when there are no user reviews yet.
  avg(wr.rating) filter (where wr.source = 'user' and wr.is_hidden = false)::real as user_avg_rating,
  least(1.0, sum(wr.w) / 20.0) as confidence,
  avg(nullif(wr.wifi_rating, 0))::real        as wifi_mean,
  avg(nullif(wr.noise_rating, 0))::real       as noise_mean,
  avg(nullif(wr.seating_rating, 0))::real     as seating_mean,
  avg(nullif(wr.outlets_rating, 0))::real     as outlets_mean,
  avg(nullif(wr.price_rating, 0))::real       as price_mean,
  avg(nullif(wr.atmosphere_rating, 0))::real  as atmosphere_mean,
  avg(nullif(wr.temperature_rating, 0))::real as temperature_mean,
  avg(nullif(wr.food_rating, 0))::real        as food_mean
from weighted_reviews wr
left join category_means cm on cm.category = wr.category
group by wr.place_id;

create unique index if not exists mv_place_ratings_idx on public.mv_place_ratings (place_id);
