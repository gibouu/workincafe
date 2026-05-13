-- Migration 027 — admin_merge_places(source, target) RPC.
--
-- Collapses a duplicate place row by transferring every FK reference from
-- `source` to `target`, then deleting the source row. Used by the admin
-- merge tool (#37 / dedup follow-up).
--
-- Conflict handling:
--   - favorites: composite PK on (user_id, place_id). If a user favorited
--     both source and target, drop the source-side row before updating.
--   - place_source_refs: UNIQUE (source, external_id). If both rows came
--     from the same external source, drop the source-side ref before
--     updating.
--   - place_owners / place_claims / place_menus: no unique constraints on
--     place_id today, plain UPDATE is fine. Partial indexes would need
--     similar dedup if added later.
--
-- The function does NOT auto-merge field values from source into target.
-- Admin should verify target has the right name / address / category
-- BEFORE merging (via /admin/places inline edit). After the merge the
-- source row is gone, so missing data has to be backfilled manually.
--
-- Returns a JSONB summary of rows-moved per table so the UI can confirm
-- what happened.

set search_path = public, extensions;

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

  -- favorites: dedup on (user_id, place_id) before transfer.
  delete from public.favorites f
   where f.place_id = p_source
     and exists (
       select 1 from public.favorites g
       where g.place_id = p_target and g.user_id = f.user_id
     );
  update public.favorites set place_id = p_target where place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('favorites', v_count);

  -- place_source_refs: dedup on (source, external_id) before transfer.
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

  -- Straightforward transfers — no place-id unique constraints on these.
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

  -- Self-reference: children of the source row now belong to target.
  update public.places set parent_place_id = p_target where parent_place_id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('parent_place_id_children', v_count);

  -- Finally, drop the source row.
  delete from public.places where id = p_source;
  get diagnostics v_count = row_count;
  v_summary := v_summary || jsonb_build_object('source_deleted', v_count);

  return v_summary;
end;
$$;

comment on function public.admin_merge_places(uuid, uuid) is
  'Admin merge: transfer all FK references from source place to target, then delete source. Returns JSONB summary of rows moved per table. See #163 follow-up.';

revoke all on function public.admin_merge_places(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_merge_places(uuid, uuid) to service_role;
