-- #226 / draft 049: make the daily review limit atomic.
--
-- The API validates the place and request body, but the final daily
-- count-and-insert must happen in one database transaction. The per-user
-- advisory lock serializes concurrent submits so two requests cannot both
-- observe four reviews and insert the fifth/sixth together.

set search_path = public, extensions, pg_catalog;

create or replace function public.submit_review_rate_limited(
  p_place_id uuid,
  p_overall_rating smallint,
  p_overall_suggested smallint default null,
  p_overall_user_set boolean default null,
  p_wifi_rating smallint default null,
  p_noise_rating smallint default null,
  p_seating_rating smallint default null,
  p_outlets_rating smallint default null,
  p_food_rating smallint default null,
  p_food_value_rating smallint default null,
  p_current_busyness smallint default null,
  p_temperature_feel smallint default null,
  p_drink_price_range text default null,
  p_food_price_range text default null,
  p_ate_food boolean default null,
  p_environment_facts text[] default null,
  p_work_facts text[] default null,
  p_place_type text default null,
  p_current_seating text default null,
  p_outside_temp_c real default null,
  p_outside_condition text default null,
  p_comment text default null,
  p_coffee_quality_rating smallint default null,
  p_coffee_art_rating smallint default null,
  p_coffee_mug_rating smallint default null,
  p_coffee_no_art boolean default false,
  p_coffee_no_mug boolean default false
) returns table(id uuid, inserted boolean)
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_today_count integer;
  v_inserted_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if p_place_id is null or p_overall_rating is null then
    raise exception 'place_id and overall_rating required';
  end if;

  perform pg_advisory_xact_lock(hashtext('submit_review_rate_limited:' || v_user_id::text));

  select count(*)
    into v_today_count
    from public.reviews r
   where r.user_id = v_user_id
     and r.created_at >= date_trunc('day', now());

  if v_today_count >= 5 then
    id := null;
    inserted := false;
    return next;
    return;
  end if;

  insert into public.reviews (
    place_id,
    user_id,
    overall_rating,
    overall_suggested,
    overall_user_set,
    wifi_rating,
    noise_rating,
    seating_rating,
    outlets_rating,
    food_rating,
    food_value_rating,
    current_busyness,
    temperature_feel,
    drink_price_range,
    food_price_range,
    ate_food,
    environment_facts,
    work_facts,
    place_type,
    current_seating,
    outside_temp_c,
    outside_condition,
    comment,
    geo_verified,
    verified_lat,
    verified_lng,
    coffee_quality_rating,
    coffee_art_rating,
    coffee_mug_rating,
    coffee_no_art,
    coffee_no_mug
  ) values (
    p_place_id,
    v_user_id,
    p_overall_rating,
    p_overall_suggested,
    p_overall_user_set,
    p_wifi_rating,
    p_noise_rating,
    p_seating_rating,
    p_outlets_rating,
    p_food_rating,
    p_food_value_rating,
    p_current_busyness,
    p_temperature_feel,
    p_drink_price_range,
    p_food_price_range,
    p_ate_food,
    p_environment_facts,
    p_work_facts,
    p_place_type,
    p_current_seating,
    p_outside_temp_c,
    p_outside_condition,
    left(p_comment, 280),
    false,
    null,
    null,
    p_coffee_quality_rating,
    p_coffee_art_rating,
    p_coffee_mug_rating,
    coalesce(p_coffee_no_art, false),
    coalesce(p_coffee_no_mug, false)
  )
  returning reviews.id into v_inserted_id;

  id := v_inserted_id;
  inserted := true;
  return next;
end;
$$;

revoke all on function public.submit_review_rate_limited(
  uuid,
  smallint,
  smallint,
  boolean,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  text,
  text,
  boolean,
  text[],
  text[],
  text,
  text,
  real,
  text,
  text,
  smallint,
  smallint,
  smallint,
  boolean,
  boolean
) from public, anon;
grant execute on function public.submit_review_rate_limited(
  uuid,
  smallint,
  smallint,
  boolean,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  text,
  text,
  boolean,
  text[],
  text[],
  text,
  text,
  real,
  text,
  text,
  smallint,
  smallint,
  smallint,
  boolean,
  boolean
) to authenticated;

comment on function public.submit_review_rate_limited(
  uuid,
  smallint,
  smallint,
  boolean,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  smallint,
  text,
  text,
  boolean,
  text[],
  text[],
  text,
  text,
  real,
  text,
  text,
  smallint,
  smallint,
  smallint,
  boolean,
  boolean
) is 'Atomically inserts one authenticated user review if the user has not reached the daily review limit.';
