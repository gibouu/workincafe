-- Atomic admin approval for place requests.
--
-- Claim the pending request and create the place in one database transaction
-- so retries or concurrent admins cannot double-insert places.

set search_path = public, extensions;

create or replace function public.approve_place_request(
  p_request_id uuid,
  p_reviewer_id uuid,
  p_city text default null,
  p_country text default null
) returns table(place_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_req public.place_requests%rowtype;
  v_place_id uuid;
begin
  update public.place_requests
     set status = 'approved',
         reviewed_by = p_reviewer_id,
         reviewed_at = now(),
         rejection_reason = null
   where id = p_request_id
     and status = 'pending'
   returning * into v_req;

  if not found then
    if exists (select 1 from public.place_requests where id = p_request_id) then
      raise exception 'request already decided';
    end if;
    raise exception 'request not found';
  end if;

  insert into public.places (
    name,
    address,
    city,
    country,
    lat,
    lng,
    category
  ) values (
    v_req.name,
    v_req.address,
    p_city,
    p_country,
    v_req.lat,
    v_req.lng,
    coalesce(v_req.category_suggestion, 'other')
  )
  returning id into v_place_id;

  return query select v_place_id;
end;
$$;

revoke all on function public.approve_place_request(uuid, uuid, text, text) from public;
revoke all on function public.approve_place_request(uuid, uuid, text, text) from anon;
revoke all on function public.approve_place_request(uuid, uuid, text, text) from authenticated;

comment on function public.approve_place_request(uuid, uuid, text, text)
  is 'Atomically approve one pending place request and create the corresponding place.';
