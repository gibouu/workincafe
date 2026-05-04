-- 011: Review provenance & weight multiplier.
--
-- Adds two columns so we can ingest synthetic reviews from third-party
-- sources (Foursquare, Yelp, etc.) without giving them the same weight as
-- a verified user review:
--
--   source         — 'user' (default), 'foursquare', 'yelp', 'google', 'system'
--   source_weight  — 1.0 for user reviews, 0.5 for synthetic. Multiplies
--                    the per-review weight already computed in
--                    mv_place_ratings; user reviews are unaffected.
--
-- Synthetic reviews need a stable user_id (reviews.user_id is NOT NULL).
-- We seed a singleton 'system' user in auth.users (existing handle_new_user
-- trigger mirrors it into public.users).

alter table public.reviews
  add column if not exists source text not null default 'user',
  add column if not exists source_weight real not null default 1.0;

alter table public.reviews drop constraint if exists reviews_source_check;
alter table public.reviews add constraint reviews_source_check
  check (source in ('user', 'foursquare', 'yelp', 'google', 'system'));

alter table public.reviews drop constraint if exists reviews_source_weight_check;
alter table public.reviews add constraint reviews_source_weight_check
  check (source_weight >= 0 and source_weight <= 1.0);

create index if not exists reviews_source_idx
  on public.reviews (source) where source <> 'user';

-- Seed the system user that owns all synthetic reviews. Fixed UUID so
-- every environment lands at the same row; idempotent.
do $$
declare
  sys_id uuid := '00000000-0000-0000-0000-0000000005ed';
begin
  if not exists (select 1 from auth.users where id = sys_id) then
    insert into auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    )
    values (
      sys_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'system@workin.cafe',
      '',
      now(),
      jsonb_build_object('provider', 'system', 'providers', jsonb_build_array('system')),
      jsonb_build_object('display_name', 'Imported reviews'),
      now(),
      now()
    );
  end if;
  insert into public.users (id, display_name, trust_score)
  values (sys_id, 'Imported reviews', 0)
  on conflict (id) do nothing;
end$$;

-- Recreate mv_place_ratings so the weighted sum applies source_weight.
-- All other behavior preserved (Bayesian smoothing, time decay, etc.).
-- The smoothing now uses sum(w) rather than count(*) so synthetic-heavy
-- places aren't overweighted.
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
