-- Defense-in-depth for redeemable deal tickets.
--
-- Authenticated clients must not be able to mint deal_purchases directly
-- through the exposed public schema. Validated server routes use the service
-- role to create purchases after checking deal state, limits, and payment or
-- loyalty-spend requirements.

set search_path = public, extensions;

drop policy if exists "purchases_insert_self" on public.deal_purchases;

revoke insert on table public.deal_purchases from anon, authenticated;
