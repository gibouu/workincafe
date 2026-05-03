-- 009: Auto-promote the first user to admin.
--
-- The existing handle_new_user() trigger (001_init.sql:328) mirrors
-- auth.users → public.users on sign-up. After that mirror commits, this
-- trigger checks whether any admin exists yet; if not, promotes the new
-- user. The transaction-scoped advisory lock makes two concurrent first-
-- user inserts safe.

create or replace function public.bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  any_admin boolean;
begin
  perform pg_advisory_xact_lock(hashtext('bootstrap_first_admin'));
  select exists (select 1 from public.users where is_admin = true) into any_admin;
  if not any_admin then
    update public.users set is_admin = true where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists users_bootstrap_first_admin on public.users;
create trigger users_bootstrap_first_admin
  after insert on public.users
  for each row execute function public.bootstrap_first_admin();
