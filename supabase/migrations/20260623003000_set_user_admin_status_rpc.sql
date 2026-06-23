set search_path = public, extensions;

create or replace function public.set_user_admin_status(
  p_target_id uuid,
  p_promote boolean,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if p_target_id is null or p_promote is null or p_actor_id is null then
    raise exception 'target, promote, and actor are required';
  end if;

  perform pg_advisory_xact_lock(hashtext('set_user_admin_status'));

  update public.users
     set is_admin = p_promote,
         updated_at = now()
   where id = p_target_id;

  if not found then
    raise exception 'user not found';
  end if;

  if not p_promote then
    if not exists (select 1 from public.users where is_admin is true) then
      raise exception 'you''re the only admin - promote someone else first';
    end if;
  end if;
end;
$$;

revoke all on function public.set_user_admin_status(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.set_user_admin_status(uuid, boolean, uuid) to service_role;

comment on function public.set_user_admin_status(uuid, boolean, uuid)
  is 'Atomically changes a user admin flag while preventing demotions that leave zero admins.';
