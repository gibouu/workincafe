-- #194: single round-trip viewport query for /api/places.
--
-- The API previously ran two queries per viewport: places filtered by
-- .gte/.lte on raw lat/lng (no index on those columns → sequential scan),
-- then mv_place_ratings by id list. This function does one spatial query
-- through the places_geom_idx GIST index and joins ratings in the same
-- round trip. SECURITY INVOKER (default) so places RLS still applies.

create or replace function public.places_in_bbox(
  w double precision,
  s double precision,
  e double precision,
  n double precision,
  max_rows integer default 5000
)
returns table (
  id uuid,
  name text,
  address text,
  neighborhood text,
  category public.place_category,
  lat double precision,
  lng double precision,
  brand text,
  user_validated_at timestamptz,
  membership_required text,
  study_spot_rating double precision,
  user_rating_count integer
)
language sql
stable
as $$
  select
    p.id, p.name, p.address, p.neighborhood, p.category,
    p.lat, p.lng, p.brand, p.user_validated_at, p.membership_required,
    r.study_spot_rating::double precision,
    coalesce(r.user_rating_count, 0)::integer
  from public.places p
  left join public.mv_place_ratings r on r.place_id = p.id
  where p.geom && st_makeenvelope(w, s, e, n, 4326)::geography
  limit max_rows;
$$;

grant execute on function public.places_in_bbox(
  double precision, double precision, double precision, double precision, integer
) to anon, authenticated;
