set search_path = public, extensions;

create or replace function public.decide_flagged_review(
  p_flag_id uuid,
  p_decision text,
  p_reason text default null,
  p_reviewer_id uuid default null
) returns table(flag_id uuid)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  v_flag public.flagged_reviews%rowtype;
  v_review_user_id uuid;
begin
  if p_decision not in ('dismiss', 'hide', 'ban') then
    raise exception 'decision must be dismiss, hide, or ban';
  end if;

  update public.flagged_reviews
     set status = case
           when p_decision = 'dismiss' then 'rejected'::public.request_status
           else 'approved'::public.request_status
         end,
         resolved_by = p_reviewer_id,
         resolved_at = now(),
         resolution = concat_ws(' · ', p_decision, nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
   where id = p_flag_id
     and status = 'pending'
   returning * into v_flag;

  if not found then
    if exists (select 1 from public.flagged_reviews where id = p_flag_id) then
      raise exception 'flag already decided';
    end if;

    raise exception 'flag not found';
  end if;

  if p_decision in ('hide', 'ban') then
    update public.reviews
       set is_hidden = true,
           updated_at = now()
     where id = v_flag.review_id
     returning user_id into v_review_user_id;

    if not found then
      raise exception 'underlying review missing';
    end if;
  end if;

  if p_decision = 'ban' then
    update public.users
       set is_banned = true,
           updated_at = now()
     where id = v_review_user_id;
  end if;

  flag_id := v_flag.id;
  return next;
end;
$$;

revoke all on function public.decide_flagged_review(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.decide_flagged_review(uuid, text, text, uuid) to service_role;

comment on function public.decide_flagged_review(uuid, text, text, uuid)
  is 'Atomically decides a pending flagged review and applies hide/ban moderation side effects.';
