-- Work in Cafe — Phase 3 materialized views (spec §15, Appendix B)
-- Requires 001_init.sql applied first.
-- Apply via Supabase SQL editor or: supabase db push
--
-- For the pg_cron schedule that keeps these views fresh, apply 003_cron.sql
-- AFTER enabling the pg_cron extension in Supabase Dashboard → Database → Extensions.

-- Noise heatmap ---------------------------------------------------------------

drop materialized view if exists public.mv_noise_heatmap cascade;
create materialized view public.mv_noise_heatmap as
with all_noise as (
  select place_id, day_of_week, hour_of_day,
         noise_rating::real as score, 1.0 as weight
  from public.reviews
  where noise_rating is not null
    and created_at > now() - interval '90 days'
    and is_hidden = false
  union all
  select place_id, day_of_week, hour_of_day,
         case noise_level when 'quiet' then 1 when 'moderate' then 3 when 'loud' then 5 end::real,
         0.8
  from public.live_updates
  where noise_level is not null
    and created_at > now() - interval '90 days'
  union all
  select place_id, day_of_week, hour_of_day,
         case when avg_db < 55 then 1 when avg_db < 70 then 3 else 5 end::real,
         0.6
  from public.decibel_samples
  where avg_db is not null
    and created_at > now() - interval '90 days'
)
select place_id, day_of_week, hour_of_day,
       sum(score * weight) / nullif(sum(weight), 0) as noise_score,
       count(*) as sample_count
from all_noise
group by 1, 2, 3;
create unique index if not exists mv_noise_heatmap_idx
  on public.mv_noise_heatmap (place_id, day_of_week, hour_of_day);

-- Current live status ---------------------------------------------------------

drop materialized view if exists public.mv_current_live_status cascade;
create materialized view public.mv_current_live_status as
select distinct on (place_id)
  place_id,
  noise_level as current_noise,
  seating_availability as current_seating,
  temperature as current_temp,
  created_at as last_updated_at
from public.live_updates
where created_at > now() - interval '30 minutes'
order by place_id, created_at desc;
create unique index if not exists mv_current_live_status_idx
  on public.mv_current_live_status (place_id);

-- Place ratings (Bayesian-smoothed, per-user cap, time decay) -----------------

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
    -- Per-review weight (spec §15): capped at 5.0×, with geo-verified + paired
    -- wifi-test boost, and time decay with floor 0.3.
    least(
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
      * (count(*)::real / (count(*)::real + 8.0))
    + coalesce(max(cm.cat_mean), 3.5) * (8.0 / (count(*)::real + 8.0))
  ) as study_spot_rating,
  count(*) as rating_count,
  least(1.0, count(*)::real / 20.0) as confidence,
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

-- Trust score function (recomputed on review insert) --------------------------

create or replace function public.recompute_trust_score(p_user uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  review_count int;
  verified_count int;
  wifi_count int;
  decibel_count int;
  score real;
begin
  select count(*) into review_count from public.reviews where user_id = p_user and is_hidden = false;
  select count(*) into verified_count from public.reviews where user_id = p_user and geo_verified = true;
  select count(*) into wifi_count from public.wifi_tests where user_id = p_user;
  select count(*) into decibel_count from public.decibel_samples where user_id = p_user;

  score := 10
    + least(40, review_count::real * 2)
    + least(30, verified_count::real * 2)
    + least(10, wifi_count::real * 0.5)
    + least(10, decibel_count::real * 0.5);

  update public.users
  set trust_score = greatest(0, least(100, score))
  where id = p_user;
end;
$$;

create or replace function public.reviews_update_trust()
returns trigger language plpgsql as $$
begin
  perform public.recompute_trust_score(new.user_id);
  return new;
end;
$$;
drop trigger if exists reviews_trust_after_insert on public.reviews;
create trigger reviews_trust_after_insert
  after insert or update on public.reviews
  for each row execute procedure public.reviews_update_trust();

