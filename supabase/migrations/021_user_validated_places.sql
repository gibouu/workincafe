-- 021: User-validated places.
--
-- The cafés-only default view (#77) hides every category that isn't 'cafe'
-- unless a real user has reviewed the place. That's a fine signal but a
-- heavy ask — a user has to write a full review just to surface a
-- non-cafe place they know about. This migration adds a lighter signal:
-- when someone goes through the add-place wizard and confirms a place
-- already exists ("Did you mean…?" → tap), we mark it as user-validated
-- so it surfaces on the default view immediately. See #82.
--
-- Idempotent — `add column if not exists` no-ops on re-apply.

set search_path = public, extensions;

alter table public.places
  add column if not exists user_validated_at timestamptz;

alter table public.places
  add column if not exists validated_by uuid references public.users(id) on delete set null;

-- Partial index — every other lookup is a small set of validated rows,
-- never a full-table scan.
create index if not exists places_user_validated_at_idx
  on public.places (user_validated_at)
  where user_validated_at is not null;

-- pg_trgm similarity lookup for the add-place wizard's "Did you mean…?"
-- duplicate-detection cards. Bbox prefilter (lat/lng range) keeps the
-- scan small; similarity ranks the matches. See #82.
create or replace function public.places_nearby_with_name(
  p_lat_min double precision,
  p_lat_max double precision,
  p_lng_min double precision,
  p_lng_max double precision,
  p_query text,
  p_min_similarity real,
  p_limit integer
) returns table (
  id uuid,
  name text,
  category text,
  brand text,
  lat double precision,
  lng double precision,
  similarity real
) language sql stable as $$
  select
    p.id,
    p.name,
    p.category::text,
    p.brand,
    p.lat,
    p.lng,
    similarity(p.name, p_query) as similarity
  from public.places p
  where p.lat between p_lat_min and p_lat_max
    and p.lng between p_lng_min and p_lng_max
    and similarity(p.name, p_query) >= p_min_similarity
  order by similarity(p.name, p_query) desc, p.name asc
  limit greatest(1, least(p_limit, 25))
$$;

-- Allow anon + authenticated to call the RPC. It only reads `places`
-- (already public-readable via existing RLS) and returns no PII.
grant execute on function public.places_nearby_with_name(
  double precision, double precision, double precision, double precision,
  text, real, integer
) to anon, authenticated;
