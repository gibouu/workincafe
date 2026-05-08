-- Review v2: 1–10 rating scale, richer collected fields, review_photos table.
--
-- This migration is idempotent and safe to re-run.
--
set search_path = public, extensions;
-- Note on the rating scale change: existing rows stored under the 1–5 scale
-- continue to compute correctly in the materialized views — they simply live
-- in the lower half of the new range. Means computed across the cutover are
-- approximate. If a precise mix is ever needed, do a one-shot upscale on
-- legacy rows; we don't ship that here because the smoothing in
-- mv_place_ratings absorbs the drift.

-- 1. Widen rating check constraints from 1..5 to 1..10
alter table public.reviews drop constraint if exists reviews_overall_rating_check;
alter table public.reviews add constraint reviews_overall_rating_check
  check (overall_rating is null or overall_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_wifi_rating_check;
alter table public.reviews add constraint reviews_wifi_rating_check
  check (wifi_rating is null or wifi_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_noise_rating_check;
alter table public.reviews add constraint reviews_noise_rating_check
  check (noise_rating is null or noise_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_seating_rating_check;
alter table public.reviews add constraint reviews_seating_rating_check
  check (seating_rating is null or seating_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_comfort_rating_check;
alter table public.reviews add constraint reviews_comfort_rating_check
  check (comfort_rating is null or comfort_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_outlets_rating_check;
alter table public.reviews add constraint reviews_outlets_rating_check
  check (outlets_rating is null or outlets_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_price_rating_check;
alter table public.reviews add constraint reviews_price_rating_check
  check (price_rating is null or price_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_atmosphere_rating_check;
alter table public.reviews add constraint reviews_atmosphere_rating_check
  check (atmosphere_rating is null or atmosphere_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_food_rating_check;
alter table public.reviews add constraint reviews_food_rating_check
  check (food_rating is null or food_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_temperature_rating_check;
alter table public.reviews add constraint reviews_temperature_rating_check
  check (temperature_rating is null or temperature_rating between 1 and 10);

-- 2. New collected columns
alter table public.reviews
  add column if not exists drink_price_range text,
  add column if not exists food_price_range  text,
  add column if not exists ate_food          boolean,
  add column if not exists food_value_rating smallint,
  add column if not exists environment_facts text[],
  add column if not exists work_facts        text[],
  add column if not exists place_type        text,
  add column if not exists current_seating   text,
  add column if not exists current_busyness  smallint,
  add column if not exists temperature_feel  smallint,
  add column if not exists outside_temp_c    real,
  add column if not exists outside_condition text,
  add column if not exists overall_suggested smallint,
  add column if not exists overall_user_set  boolean;

alter table public.reviews drop constraint if exists reviews_food_value_rating_check;
alter table public.reviews add constraint reviews_food_value_rating_check
  check (food_value_rating is null or food_value_rating between 1 and 10);

alter table public.reviews drop constraint if exists reviews_current_busyness_check;
alter table public.reviews add constraint reviews_current_busyness_check
  check (current_busyness is null or current_busyness between 1 and 10);

alter table public.reviews drop constraint if exists reviews_temperature_feel_check;
alter table public.reviews add constraint reviews_temperature_feel_check
  check (temperature_feel is null or temperature_feel between 1 and 10);

alter table public.reviews drop constraint if exists reviews_overall_suggested_check;
alter table public.reviews add constraint reviews_overall_suggested_check
  check (overall_suggested is null or overall_suggested between 1 and 10);

-- 3. review_photos table
create table if not exists public.review_photos (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  slot text not null check (slot in ('menu','inside','outside','special')),
  path text not null,
  width int,
  height int,
  bytes int,
  is_demo boolean not null default false,
  created_at timestamptz default now(),
  unique (review_id, slot)
);

create index if not exists review_photos_review_idx on public.review_photos (review_id);
create index if not exists review_photos_is_demo_idx on public.review_photos (is_demo) where is_demo = true;

alter table public.review_photos enable row level security;

drop policy if exists "review_photos_read_all" on public.review_photos;
create policy "review_photos_read_all" on public.review_photos for select using (true);

drop policy if exists "review_photos_insert_own_review" on public.review_photos;
create policy "review_photos_insert_own_review" on public.review_photos for insert
  with check (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
  );

drop policy if exists "review_photos_delete_own_review" on public.review_photos;
create policy "review_photos_delete_own_review" on public.review_photos for delete
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id and r.user_id = auth.uid()
    )
  );
