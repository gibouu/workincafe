-- Award loyalty points inside deal redemption.
--
-- The route calls redeem_deal_purchase() to decrement the ticket and insert
-- the deal_use atomically. The earned loyalty point must live in that same
-- transaction so a successful redemption cannot be separated from its point
-- event by a later route/runtime failure.

set search_path = public, extensions;

create or replace function public.redeem_deal_purchase(
  p_purchase_id uuid,
  p_scanned_by uuid,
  p_notes text default null,
  p_is_demo boolean default false
) returns table (
  use_id uuid,
  uses_remaining int,
  uses_total int
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_purchase record;
  v_use_id uuid;
begin
  update public.deal_purchases
     set uses_remaining = deal_purchases.uses_remaining - 1
   where id = p_purchase_id
     and deal_purchases.uses_remaining > 0
   returning deal_purchases.user_id,
             deal_purchases.deal_id,
             deal_purchases.place_id,
             deal_purchases.uses_remaining,
             deal_purchases.uses_total
        into v_purchase;

  if not found then
    raise exception 'no uses remaining';
  end if;

  insert into public.deal_uses (
    purchase_id,
    scanned_by,
    notes,
    is_demo
  ) values (
    p_purchase_id,
    p_scanned_by,
    case when p_notes is null then null else left(p_notes, 200) end,
    coalesce(p_is_demo, false)
  )
  returning id into v_use_id;

  insert into public.point_events (
    user_id,
    kind,
    delta,
    related_use_id,
    related_purchase_id,
    related_place_id,
    related_deal_id,
    is_demo
  ) values (
    v_purchase.user_id,
    'earned_use',
    1,
    v_use_id,
    p_purchase_id,
    v_purchase.place_id,
    v_purchase.deal_id,
    coalesce(p_is_demo, false)
  );

  use_id := v_use_id;
  uses_remaining := v_purchase.uses_remaining;
  uses_total := v_purchase.uses_total;
  return next;
end;
$$;

revoke all on function public.redeem_deal_purchase(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.redeem_deal_purchase(uuid, uuid, text, boolean)
  to service_role;
