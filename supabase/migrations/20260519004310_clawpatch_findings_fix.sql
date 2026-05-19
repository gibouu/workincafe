-- Fixes for Clawpatch findings across RLS, cron idempotency, seed source
-- enums, place merge conflicts, and Wi-Fi rate limiting.

set search_path = public, extensions;

-- Seed scripts write these sources into place_source_refs.
alter type public.place_source add value if not exists 'curated';
alter type public.place_source add value if not exists 'foursquare';

-- deal_purchases are redeemable tickets. They must be created by validated
-- server paths only, not directly by authenticated PostgREST clients.
drop policy if exists "purchases_insert_self" on public.deal_purchases;

-- The route calls this RPC for non-demo users. It serializes the per
-- user/place check + insert under one transaction so concurrent requests
-- cannot both pass the one-per-hour rule.
create or replace function public.insert_wifi_test_rate_limited(
  p_place_id uuid,
  p_download_mbps real default null,
  p_upload_mbps real default null,
  p_ping_ms real default null,
  p_connection_type text default null,
  p_geo_verified boolean default false
) returns table(id uuid, inserted boolean)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_inserted_id uuid;
begin
  if v_user_id is null then
    raise exception 'authenticated user required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_place_id::text, 0));

  select wt.id into v_existing_id
    from public.wifi_tests wt
   where wt.user_id = v_user_id
     and wt.place_id = p_place_id
     and wt.created_at >= now() - interval '1 hour'
   limit 1;

  if v_existing_id is not null then
    id := v_existing_id;
    inserted := false;
    return next;
    return;
  end if;

  insert into public.wifi_tests (
    place_id,
    user_id,
    download_mbps,
    upload_mbps,
    ping_ms,
    connection_type,
    geo_verified
  ) values (
    p_place_id,
    v_user_id,
    p_download_mbps,
    p_upload_mbps,
    p_ping_ms,
    p_connection_type,
    p_geo_verified
  )
  returning wifi_tests.id into v_inserted_id;

  id := v_inserted_id;
  inserted := true;
  return next;
end;
$$;

revoke all on function public.insert_wifi_test_rate_limited(uuid, real, real, real, text, boolean) from public, anon;
grant execute on function public.insert_wifi_test_rate_limited(uuid, real, real, real, text, boolean) to authenticated;

create or replace function public.cron_expire_loyalty()
  returns table(rows_expired int)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  inserted_count int;
begin
  if not pg_try_advisory_xact_lock(hashtext('cron_expire_loyalty')) then
    rows_expired := 0;
    return next;
  end if;

  with totals as (
    select
      user_id,
      sum(case when kind = 'earned_use' and created_at >= now() - interval '12 months'
               then delta else 0 end) as fresh_earned,
      sum(delta) as current_balance
    from public.point_events
    where is_demo = false
    group by user_id
  ),
  candidates as (
    select
      user_id,
      greatest(coalesce(current_balance, 0) - greatest(coalesce(fresh_earned, 0), 0), 0)::int as expire_amount
    from totals
  ),
  inserted as (
    insert into public.point_events (user_id, kind, delta, notes)
    select user_id, 'expired', -expire_amount, 'Annual loyalty expiry sweep'
    from candidates
    where expire_amount > 0
    returning id
  )
  select count(*) into inserted_count from inserted;

  rows_expired := inserted_count;
  return next;
end;
$$;

revoke all on function public.cron_expire_loyalty() from public;
revoke all on function public.cron_expire_loyalty() from anon;
revoke all on function public.cron_expire_loyalty() from authenticated;

create or replace function public.admin_merge_places(
  p_source uuid,
  p_target uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_summary jsonb := '{}'::jsonb;
  v_count int;
begin
  if p_source is null or p_target is null then
    raise exception 'source and target are required';
  end if;
  if p_source = p_target then
    raise exception 'source and target must differ';
  end if;
  if not exists (select 1 from public.places where id = p_source) then
    raise exception 'source % not found', p_source;
  end if;
  if not exists (select 1 from public.places where id = p_target) then
    raise exception 'target % not found', p_target;
  end if;

  delete from public.favorites f
   where f.place_id = p_source
     and exists (
       select 1 from public.favorites g
       where g.place_id = p_target and g.user_id = f.user_id
     );
  update public.favorites set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('favorites', v_count);

  delete from public.place_source_refs psr
   where psr.place_id = p_source
     and exists (
       select 1 from public.place_source_refs other
       where other.place_id = p_target
         and other.source = psr.source
         and other.external_id = psr.external_id
     );
  update public.place_source_refs set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('place_source_refs', v_count);

  update public.reviews set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('reviews', v_count);

  update public.checkins set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('checkins', v_count);

  update public.live_updates set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('live_updates', v_count);

  update public.wifi_tests set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('wifi_tests', v_count);

  update public.decibel_samples set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('decibel_samples', v_count);

  update public.deals set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('deals', v_count);

  update public.deal_purchases set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('deal_purchases', v_count);

  update public.place_menus set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('place_menus', v_count);

  delete from public.place_owners po
   where po.place_id = p_source
     and po.revoked_at is null
     and exists (
       select 1 from public.place_owners other
       where other.place_id = p_target
         and other.user_id = po.user_id
         and other.revoked_at is null
     );
  update public.place_owners set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('place_owners', v_count);

  update public.place_claims set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('place_claims', v_count);

  update public.waitlist_business set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('waitlist_business', v_count);

  update public.point_events set related_place_id = p_target where related_place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('point_events', v_count);

  update public.places set parent_place_id = p_target where parent_place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('parent_place_id_children', v_count);

  delete from public.places where id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('source_deleted', v_count);

  return v_summary;
end;
$$;

comment on function public.admin_merge_places(uuid, uuid) is
  'Admin merge: transfer all FK references from source place to target, then delete source. Returns JSONB summary of rows moved per table.';

revoke all on function public.admin_merge_places(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_merge_places(uuid, uuid) to service_role;
