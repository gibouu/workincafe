-- 019: Coffee review signals.
--
-- Adds coffee-specific rating columns to `reviews` (quality / art / mug
-- 1–10 sliders + two opt-out booleans), extends `review_photos.slot` so a
-- dedicated 'coffee' photo can be uploaded, and surfaces a per-place
-- `coffee_mean` + `coffee_review_count` on `mv_place_ratings`. See #85.
--
-- Idempotent and safe to re-run.

set search_path = public, extensions;

-- Reviews: three coffee sliders + two opt-out booleans.
-- The booleans capture intent ("the user said this place doesn't serve
-- art / I had a to-go cup") so we can distinguish opt-out from skipped.
alter table public.reviews
  add column if not exists coffee_quality_rating smallint
    check (coffee_quality_rating is null or coffee_quality_rating between 1 and 10);
alter table public.reviews
  add column if not exists coffee_art_rating smallint
    check (coffee_art_rating is null or coffee_art_rating between 1 and 10);
alter table public.reviews
  add column if not exists coffee_mug_rating smallint
    check (coffee_mug_rating is null or coffee_mug_rating between 1 and 10);
alter table public.reviews
  add column if not exists coffee_no_art boolean default false;
alter table public.reviews
  add column if not exists coffee_no_mug boolean default false;

-- review_photos.slot — extend the existing CHECK to include 'coffee'.
alter table public.review_photos
  drop constraint if exists review_photos_slot_check;
alter table public.review_photos
  add constraint review_photos_slot_check
    check (slot in ('menu','inside','outside','special','coffee'));

-- Recreate mv_place_ratings with two new aggregate columns:
--   coffee_mean         — weighted mean coffee rating per place (user reviews only)
--   coffee_review_count — number of user reviews with a coffee_quality_rating set
--
-- Per-review coffee score weights quality at 1.0 and the optional art / mug
-- ratings at 0.5 each. Opt-outs (NULL art or mug) drop their weight entirely
-- so a review with quality=8 and "no art served" still scores 8 — not
-- penalised for missing data. See #85.
--
-- Verbatim from 018 plus the coffee aggregates. Idempotent.

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
    case
      when r.coffee_quality_rating is null then null
      else (
        r.coffee_quality_rating * 1.0
        + coalesce(r.coffee_art_rating, 0) * 0.5
        + coalesce(r.coffee_mug_rating, 0) * 0.5
      ) / (
        1.0
        + case when r.coffee_art_rating is null then 0.0 else 0.5 end
        + case when r.coffee_mug_rating is null then 0.0 else 0.5 end
      )
    end as coffee_review_rating,
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
  avg(wr.rating) filter (where wr.source = 'user' and wr.is_hidden = false)::real as user_avg_rating,
  least(1.0, sum(wr.w) / 20.0) as confidence,
  avg(nullif(wr.wifi_rating, 0))::real        as wifi_mean,
  avg(nullif(wr.noise_rating, 0))::real       as noise_mean,
  avg(nullif(wr.seating_rating, 0))::real     as seating_mean,
  avg(nullif(wr.outlets_rating, 0))::real     as outlets_mean,
  avg(nullif(wr.price_rating, 0))::real       as price_mean,
  avg(nullif(wr.atmosphere_rating, 0))::real  as atmosphere_mean,
  avg(nullif(wr.temperature_rating, 0))::real as temperature_mean,
  avg(nullif(wr.food_rating, 0))::real        as food_mean,
  avg(wr.coffee_review_rating)
    filter (where wr.source = 'user' and wr.is_hidden = false)::real as coffee_mean,
  count(*) filter (
    where wr.coffee_review_rating is not null
      and wr.source = 'user'
      and wr.is_hidden = false
  ) as coffee_review_count
from weighted_reviews wr
left join category_means cm on cm.category = wr.category
group by wr.place_id;

create unique index if not exists mv_place_ratings_idx on public.mv_place_ratings (place_id);
