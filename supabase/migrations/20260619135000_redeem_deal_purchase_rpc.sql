-- Make deal redemption atomic.
--
-- The API used to decrement deal_purchases.uses_remaining, insert deal_uses,
-- and then try a best-effort rollback if the insert failed. That rollback
-- wrote an absolute stale counter value and could overwrite a concurrent
-- successful redemption. This RPC keeps the decrement and use row insert in
-- one database transaction; if the insert fails, PostgreSQL rolls back the
-- decrement automatically.

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
   returning deal_purchases.uses_remaining,
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
