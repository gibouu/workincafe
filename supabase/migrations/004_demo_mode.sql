-- Demo mode markers.
-- Apply this after 001_init.sql when you want demo-created data to be
-- queryable and erasable separately from real user activity.

alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.places add column if not exists is_demo boolean not null default false;
alter table public.place_source_refs add column if not exists is_demo boolean not null default false;
alter table public.place_requests add column if not exists is_demo boolean not null default false;
alter table public.reviews add column if not exists is_demo boolean not null default false;
alter table public.checkins add column if not exists is_demo boolean not null default false;
alter table public.wifi_tests add column if not exists is_demo boolean not null default false;
alter table public.decibel_samples add column if not exists is_demo boolean not null default false;
alter table public.favorites add column if not exists is_demo boolean not null default false;
alter table public.live_updates add column if not exists is_demo boolean not null default false;
alter table public.flagged_reviews add column if not exists is_demo boolean not null default false;

create index if not exists users_is_demo_idx on public.users (is_demo) where is_demo = true;
create index if not exists places_is_demo_idx on public.places (is_demo) where is_demo = true;
create index if not exists place_source_refs_is_demo_idx on public.place_source_refs (is_demo) where is_demo = true;
create index if not exists place_requests_is_demo_idx on public.place_requests (is_demo) where is_demo = true;
create index if not exists reviews_is_demo_idx on public.reviews (is_demo) where is_demo = true;
create index if not exists checkins_is_demo_idx on public.checkins (is_demo) where is_demo = true;
create index if not exists wifi_tests_is_demo_idx on public.wifi_tests (is_demo) where is_demo = true;
create index if not exists decibel_samples_is_demo_idx on public.decibel_samples (is_demo) where is_demo = true;
create index if not exists favorites_is_demo_idx on public.favorites (is_demo) where is_demo = true;
create index if not exists live_updates_is_demo_idx on public.live_updates (is_demo) where is_demo = true;
create index if not exists flagged_reviews_is_demo_idx on public.flagged_reviews (is_demo) where is_demo = true;

-- Cleanup helper for demo activity in public tables. The auth.users demo
-- account can be deleted separately from the Supabase Auth dashboard/API.
create or replace function public.delete_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.flagged_reviews where is_demo = true;
  delete from public.live_updates where is_demo = true;
  delete from public.favorites where is_demo = true;
  delete from public.decibel_samples where is_demo = true;
  delete from public.wifi_tests where is_demo = true;
  delete from public.checkins where is_demo = true;
  delete from public.reviews where is_demo = true;
  delete from public.place_requests where is_demo = true;
  delete from public.place_source_refs where is_demo = true;
  delete from public.places where is_demo = true;
  delete from public.users where is_demo = true;
end;
$$;
