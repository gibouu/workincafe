-- Atomic freebie claim.
--
-- The API chooses an eligible nearby place, but the final commit must issue
-- the freebie ticket and spend points in one database transaction. The
-- per-user advisory lock serializes concurrent claims for the same user.

set search_path = public, extensions;

create or replace function public.claim_freebie_purchase(
  p_user_id uuid,
  p_place_id uuid,
  p_qr_code text,
  p_is_demo boolean default false
) returns table(id uuid, qr_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance integer;
  v_distinct_places integer;
  v_purchase_id uuid;
begin
  if p_user_id is null or p_place_id is null or nullif(trim(p_qr_code), '') is null then
    raise exception 'user, place, and qr code are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('claim_freebie_purchase:' || p_user_id::text));

  select coalesce(sum(delta), 0)::integer
    into v_balance
    from public.point_events
   where user_id = p_user_id;

  select count(distinct p.place_id)::integer
    into v_distinct_places
    from public.deal_purchases p
   where p.user_id = p_user_id
     and exists (
       select 1
         from public.deal_uses du
        where du.purchase_id = p.id
     );

  if v_balance < 20 or v_distinct_places < 5 then
    raise exception 'freebie not unlocked';
  end if;

  insert into public.deal_purchases (
    deal_id,
    place_id,
    user_id,
    qr_code,
    uses_total,
    uses_remaining,
    amount_paid_cents,
    currency,
    payment_method,
    is_demo
  ) values (
    null,
    p_place_id,
    p_user_id,
    p_qr_code,
    1,
    1,
    0,
    'EUR',
    'freebie',
    p_is_demo
  )
  returning deal_purchases.id into v_purchase_id;

  insert into public.point_events (
    user_id,
    kind,
    delta,
    related_purchase_id,
    related_place_id,
    notes,
    is_demo
  ) values (
    p_user_id,
    'spent_freebie',
    -20,
    v_purchase_id,
    p_place_id,
    'Free coffee redemption',
    p_is_demo
  );

  return query
    select v_purchase_id, p_qr_code;
end;
$$;

revoke all on function public.claim_freebie_purchase(uuid, uuid, text, boolean) from public;
revoke all on function public.claim_freebie_purchase(uuid, uuid, text, boolean) from anon;
revoke all on function public.claim_freebie_purchase(uuid, uuid, text, boolean) from authenticated;

comment on function public.claim_freebie_purchase(uuid, uuid, text, boolean)
  is 'Atomically issue a platform freebie purchase and spend loyalty points for a user.';
