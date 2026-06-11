-- #194 follow-up: the geography && st_makeenvelope(...) filter matches
-- NOTHING for envelopes wider than 180° — geography edges wrap the short
-- way around the globe, so the world/continent zoom levels returned an
-- empty map (verified: ±179° bbox → 0 rows, lat/lng filter → 40,064).
--
-- Filter on raw lat/lng instead, which is exactly the legacy route
-- semantics (parseBbox rejects antimeridian-crossing boxes, so BETWEEN
-- is always valid), backed by a btree index — those columns had none.
-- The places subquery is limited BEFORE the ratings join so wide
-- viewports don't join the whole table against mv_place_ratings.

create index if not exists places_lng_lat_idx on public.places (lng, lat);

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
  from (
    select *
    from public.places
    where lng between w and e
      and lat between s and n
    limit max_rows
  ) p
  left join public.mv_place_ratings r on r.place_id = p.id;
$$;
