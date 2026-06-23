-- #227 / draft 052: make the hourly decibel sample limit atomic.
--
-- The route validates request shape and resolves demo place ids, but live
-- authenticated submissions must count and insert inside one transaction.
-- The per-user advisory lock serializes concurrent submissions so two
-- requests cannot both observe two samples and insert the third/fourth
-- together.

set search_path = public, extensions, pg_catalog;

create or replace function public.submit_decibel_sample_rate_limited(
  p_place_id uuid,
  p_avg_db real,
  p_peak_db real default null,
  p_duration_seconds integer default null,
  p_device_model text default null
) returns table(id uuid, inserted boolean)
language plpgsql
set search_path = public, extensions, pg_catalog
as $$
declare
  v_user_id uuid := auth.uid();
  v_hour_count integer;
  v_inserted_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  if p_place_id is null or p_avg_db is null then
    raise exception 'place_id and avg_db required';
  end if;

  perform pg_advisory_xact_lock(hashtext('submit_decibel_sample_rate_limited:' || v_user_id::text));

  select count(*)
    into v_hour_count
    from public.decibel_samples d
   where d.user_id = v_user_id
     and d.created_at >= now() - interval '1 hour';

  if v_hour_count >= 3 then
    id := null;
    inserted := false;
    return next;
    return;
  end if;

  insert into public.decibel_samples (
    place_id,
    user_id,
    avg_db,
    peak_db,
    duration_seconds,
    device_model
  ) values (
    p_place_id,
    v_user_id,
    p_avg_db,
    p_peak_db,
    p_duration_seconds,
    nullif(left(coalesce(p_device_model, ''), 120), '')
  )
  returning decibel_samples.id into v_inserted_id;

  id := v_inserted_id;
  inserted := true;
  return next;
end;
$$;

revoke all on function public.submit_decibel_sample_rate_limited(
  uuid,
  real,
  real,
  integer,
  text
) from public, anon;
grant execute on function public.submit_decibel_sample_rate_limited(
  uuid,
  real,
  real,
  integer,
  text
) to authenticated;

comment on function public.submit_decibel_sample_rate_limited(
  uuid,
  real,
  real,
  integer,
  text
) is 'Atomically inserts one authenticated decibel sample if the user has not reached the hourly decibel sample limit.';
