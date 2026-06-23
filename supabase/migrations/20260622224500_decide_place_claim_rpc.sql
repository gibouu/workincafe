set search_path = public, extensions;

create or replace function public.decide_place_claim(
  p_claim_id uuid,
  p_decision text,
  p_reviewer_id uuid,
  p_rejection_reason text default null
)
returns table (
  id uuid,
  place_id uuid,
  claimant_user_id uuid,
  claimant_email text,
  status public.request_status
)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_claim public.place_claims%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  update public.place_claims
     set status = p_decision::public.request_status,
         reviewed_by = p_reviewer_id,
         reviewed_at = now(),
         rejection_reason = case
           when p_decision = 'rejected' then nullif(left(coalesce(p_rejection_reason, ''), 500), '')
           else null
         end
   where id = p_claim_id
     and status = 'pending'
   returning * into v_claim;

  if not found then
    if exists (select 1 from public.place_claims where id = p_claim_id) then
      raise exception 'claim already decided';
    end if;

    raise exception 'claim not found';
  end if;

  if p_decision = 'approved' then
    insert into public.place_owners (place_id, user_id, granted_by, is_demo)
    values (v_claim.place_id, v_claim.claimant_user_id, p_reviewer_id, v_claim.is_demo)
    on conflict do nothing;
  end if;

  id := v_claim.id;
  place_id := v_claim.place_id;
  claimant_user_id := v_claim.claimant_user_id;
  claimant_email := v_claim.claimant_email;
  status := v_claim.status;
  return next;
end;
$$;

revoke all on function public.decide_place_claim(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_place_claim(uuid, text, uuid, text) to service_role;

comment on function public.decide_place_claim(uuid, text, uuid, text)
  is 'Atomically decides a pending place claim and grants ownership for approvals.';
