-- #226 / draft 037: browser geolocation is user-controlled, so direct
-- authenticated review writes must never mint or alter trusted geo fields.
--
-- The current /api/reviews path uses the user's Supabase session rather than
-- service_role, so this keeps normal review inserts working by accepting only
-- untrusted geo state from authenticated clients. A future trusted server path
-- can use service_role/admin SQL and bypass this client-role normalization.

set search_path = pg_catalog, public, extensions;

create or replace function public.prevent_client_review_geo_trust()
returns trigger
language plpgsql
set search_path = pg_catalog, public, extensions
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.geo_verified := false;
      new.verified_lat := null;
      new.verified_lng := null;
    elsif tg_op = 'UPDATE' then
      new.geo_verified := old.geo_verified;
      new.verified_lat := old.verified_lat;
      new.verified_lng := old.verified_lng;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_client_geo_trust_guard on public.reviews;
create trigger reviews_client_geo_trust_guard
  before insert or update of geo_verified, verified_lat, verified_lng
  on public.reviews
  for each row execute function public.prevent_client_review_geo_trust();

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and geo_verified is false
    and verified_lat is null
    and verified_lng is null
  );

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
