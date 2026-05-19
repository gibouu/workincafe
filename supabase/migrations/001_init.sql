-- Work in Cafe — Phase 1 init (spec §17.1, Appendix A)
-- NOTE: this file has not been applied. To run:
--   supabase link --project-ref <ref>
--   supabase db push
-- Or paste into Supabase SQL editor.

-- Extensions ---------------------------------------------------------------

create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

set search_path = public, extensions;

-- Enums --------------------------------------------------------------------

do $$ begin
  create type place_category as enum (
    'cafe','bakery','library','coworking','hotel','restaurant','fast_food','other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type noise_level as enum ('quiet','moderate','loud');
exception when duplicate_object then null; end $$;

do $$ begin
  create type seating_availability as enum ('plenty','some','full');
exception when duplicate_object then null; end $$;

do $$ begin
  create type temperature_level as enum ('cold','comfortable','warm','hot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type place_source as enum ('apple','google','osm','curated','foursquare','user_submitted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type flag_reason as enum ('spam','offensive','untrue','irrelevant','other');
exception when duplicate_object then null; end $$;

-- Users --------------------------------------------------------------------

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  trust_score real default 10,
  home_city text,
  is_admin boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Places -------------------------------------------------------------------

create table if not exists public.places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  city text,
  country text,
  neighborhood text,
  lat double precision not null,
  lng double precision not null,
  geom geography(point, 4326) generated always as
    (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  category place_category not null default 'other',
  brand text,
  phone text,
  website text,
  hours_json jsonb,
  osm_tags jsonb,
  featured boolean default false,
  normalized_name_hash text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists places_geom_idx on public.places using gist (geom);
create index if not exists places_category_idx on public.places (category);
create index if not exists places_name_trgm_idx on public.places using gin (name gin_trgm_ops);
create index if not exists places_featured_idx on public.places (featured) where featured = true;

create table if not exists public.place_source_refs (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid references public.places(id) on delete cascade,
  normalized_name_hash text,
  source place_source not null,
  external_id text not null,
  synced_at timestamptz default now(),
  unique (source, external_id)
);

create table if not exists public.place_requests (
  id uuid primary key default uuid_generate_v4(),
  submitted_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  category_suggestion place_category,
  notes text,
  status request_status default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

-- Reviews ------------------------------------------------------------------

create table if not exists public.reviews (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  overall_rating smallint check (overall_rating between 1 and 5),
  wifi_rating smallint check (wifi_rating between 1 and 5),
  noise_rating smallint check (noise_rating between 1 and 5),
  seating_rating smallint check (seating_rating between 1 and 5),
  comfort_rating smallint check (comfort_rating between 1 and 5),
  outlets_rating smallint check (outlets_rating between 1 and 5),
  price_rating smallint check (price_rating between 1 and 5),
  atmosphere_rating smallint check (atmosphere_rating between 1 and 5),
  food_rating smallint check (food_rating between 1 and 5),
  temperature_rating smallint check (temperature_rating between 1 and 5),
  comment text check (char_length(comment) <= 280),
  geo_verified boolean default false,
  verified_lat double precision,
  verified_lng double precision,
  hour_of_day smallint,
  day_of_week smallint,
  upvotes_count int default 0,
  is_hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists reviews_place_idx on public.reviews (place_id);
create index if not exists reviews_user_idx on public.reviews (user_id);
create index if not exists reviews_dow_hod_idx on public.reviews (place_id, day_of_week, hour_of_day);

create table if not exists public.checkins (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  verified boolean default false,
  studying_until timestamptz,
  hour_of_day smallint,
  day_of_week smallint,
  created_at timestamptz default now()
);

create table if not exists public.wifi_tests (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  download_mbps real, upload_mbps real, ping_ms real,
  connection_type text, geo_verified boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.decibel_samples (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  avg_db real, peak_db real, duration_seconds int, device_model text,
  hour_of_day smallint, day_of_week smallint,
  created_at timestamptz default now()
);

create table if not exists public.favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);

create table if not exists public.live_updates (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  noise_level noise_level,
  seating_availability seating_availability,
  temperature temperature_level,
  hour_of_day smallint, day_of_week smallint,
  created_at timestamptz default now()
);
create index if not exists live_updates_place_time_idx on public.live_updates (place_id, created_at desc);

create table if not exists public.flagged_reviews (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason flag_reason not null,
  notes text,
  status request_status default 'pending',
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz default now()
);

create table if not exists public.apple_fill_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  tile_hash text not null,
  created_at timestamptz default now()
);
create index if not exists apple_fill_log_idx on public.apple_fill_log (user_id, tile_hash, created_at desc);

create table if not exists public.waitlist_partners (
  id uuid primary key default uuid_generate_v4(),
  email text not null, created_at timestamptz default now()
);
create table if not exists public.waitlist_business (
  id uuid primary key default uuid_generate_v4(),
  email text not null, place_id uuid references public.places(id),
  created_at timestamptz default now()
);

-- RLS ----------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.places enable row level security;
alter table public.place_source_refs enable row level security;
alter table public.place_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.checkins enable row level security;
alter table public.wifi_tests enable row level security;
alter table public.decibel_samples enable row level security;
alter table public.favorites enable row level security;
alter table public.live_updates enable row level security;
alter table public.flagged_reviews enable row level security;
alter table public.apple_fill_log enable row level security;
alter table public.waitlist_partners enable row level security;
alter table public.waitlist_business enable row level security;

drop policy if exists "users_read_all" on public.users;
create policy "users_read_all" on public.users for select using (true);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid() = id);
drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users for insert with check (auth.uid() = id);

drop policy if exists "places_read_all" on public.places;
create policy "places_read_all" on public.places for select using (true);
drop policy if exists "places_admin_write" on public.places;
create policy "places_admin_write" on public.places for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

drop policy if exists "psr_read_all" on public.place_source_refs;
create policy "psr_read_all" on public.place_source_refs for select using (true);
drop policy if exists "psr_admin_write" on public.place_source_refs;
create policy "psr_admin_write" on public.place_source_refs for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

drop policy if exists "pr_read_own_or_admin" on public.place_requests;
create policy "pr_read_own_or_admin" on public.place_requests for select using (
  submitted_by = auth.uid() or
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);
drop policy if exists "pr_insert_own" on public.place_requests;
create policy "pr_insert_own" on public.place_requests for insert with check (submitted_by = auth.uid());
drop policy if exists "pr_admin_update" on public.place_requests;
create policy "pr_admin_update" on public.place_requests for update using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

drop policy if exists "reviews_read_visible" on public.reviews;
create policy "reviews_read_visible" on public.reviews for select using (
  is_hidden = false or auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);
drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own" on public.reviews for update using (auth.uid() = user_id);

drop policy if exists "checkins_read_all" on public.checkins;
create policy "checkins_read_all" on public.checkins for select using (true);
drop policy if exists "checkins_insert_own" on public.checkins;
create policy "checkins_insert_own" on public.checkins for insert with check (auth.uid() = user_id);

drop policy if exists "wifi_read_all" on public.wifi_tests;
create policy "wifi_read_all" on public.wifi_tests for select using (true);
drop policy if exists "wifi_insert_own" on public.wifi_tests;
create policy "wifi_insert_own" on public.wifi_tests for insert with check (auth.uid() = user_id);

drop policy if exists "decibel_read_all" on public.decibel_samples;
create policy "decibel_read_all" on public.decibel_samples for select using (true);
drop policy if exists "decibel_insert_own" on public.decibel_samples;
create policy "decibel_insert_own" on public.decibel_samples for insert with check (auth.uid() = user_id);

drop policy if exists "favs_rw_own" on public.favorites;
create policy "favs_rw_own" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "live_read_all" on public.live_updates;
create policy "live_read_all" on public.live_updates for select using (true);
drop policy if exists "live_insert_own" on public.live_updates;
create policy "live_insert_own" on public.live_updates for insert with check (auth.uid() = user_id);

drop policy if exists "fr_insert_auth" on public.flagged_reviews;
create policy "fr_insert_auth" on public.flagged_reviews for insert with check (auth.uid() = reporter_id);
drop policy if exists "fr_admin_all" on public.flagged_reviews;
create policy "fr_admin_all" on public.flagged_reviews for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

drop policy if exists "apple_log_insert_own" on public.apple_fill_log;
create policy "apple_log_insert_own" on public.apple_fill_log for insert with check (auth.uid() = user_id);
drop policy if exists "apple_log_read_own" on public.apple_fill_log;
create policy "apple_log_read_own" on public.apple_fill_log for select using (auth.uid() = user_id);

drop policy if exists "wl_partners_insert" on public.waitlist_partners;
create policy "wl_partners_insert" on public.waitlist_partners for insert with check (true);
drop policy if exists "wl_business_insert" on public.waitlist_business;
create policy "wl_business_insert" on public.waitlist_business for insert with check (true);

-- Triggers -----------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_time_columns()
returns trigger language plpgsql as $$
begin
  new.hour_of_day := extract(hour from new.created_at);
  new.day_of_week := extract(dow from new.created_at);
  return new;
end;
$$;
drop trigger if exists reviews_set_time on public.reviews;
create trigger reviews_set_time before insert on public.reviews
  for each row execute procedure public.set_time_columns();
drop trigger if exists checkins_set_time on public.checkins;
create trigger checkins_set_time before insert on public.checkins
  for each row execute procedure public.set_time_columns();
drop trigger if exists decibel_set_time on public.decibel_samples;
create trigger decibel_set_time before insert on public.decibel_samples
  for each row execute procedure public.set_time_columns();
drop trigger if exists live_set_time on public.live_updates;
create trigger live_set_time before insert on public.live_updates
  for each row execute procedure public.set_time_columns();
