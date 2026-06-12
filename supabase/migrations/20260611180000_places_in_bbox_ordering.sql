-- #194 polish: order viewport results so the rows that survive the
-- PostgREST 1000-row cap are the ones worth showing. At wide zooms the
-- function matches far more places than the cap; without ORDER BY the
-- visible subset was arbitrary heap order. Featured first, then best
-- rated. The join must now happen before LIMIT (rating is the sort
-- key); top-N heapsort keeps this cheap at 40k rows.

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
  where p.lng between w and e
    and p.lat between s and n
  order by p.featured desc, r.study_spot_rating desc nulls last
  limit max_rows;
$$;
