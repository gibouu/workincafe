-- 022: Security hardening pass per Supabase advisor lints.
--
-- Runs alongside the platform-level fixes already applied via MCP. This
-- file makes the same changes reproducible from a fresh clone so anyone
-- replaying the migration history lands in the same hardened state.
--
-- Closes:
--   - lint 0011_function_search_path_mutable (6 functions pinned)
--   - lint 0025_public_bucket_allows_listing (review-photos policies dropped)
--   - lints 0028 / 0029 anon/authenticated SECURITY DEFINER executable
--     (4 user-defined SECURITY DEFINER functions revoked from public roles)
--
-- Idempotent — `if exists` guards on every drop.

-- 1. Pin search_path on user-defined functions ------------------------------
-- Pinning prevents an attacker from defining a `public.now()` or similar
-- shadow function that hijacks built-in calls inside our function bodies.
-- `pg_catalog, public, extensions` keeps existing references resolving
-- while ensuring built-ins always win.

alter function public.set_time_columns()
  set search_path = pg_catalog, public, extensions;

alter function public.touch_stripe_accounts_updated_at()
  set search_path = pg_catalog, public, extensions;

alter function public.touch_friend_profiles_updated_at()
  set search_path = pg_catalog, public, extensions;

alter function public.user_point_balance(uid uuid)
  set search_path = pg_catalog, public, extensions;

alter function public.reviews_update_trust()
  set search_path = pg_catalog, public, extensions;

alter function public.bootstrap_first_admin()
  set search_path = pg_catalog, public, extensions;

alter function public.delete_demo_data()
  set search_path = pg_catalog, public, extensions;

alter function public.handle_new_user()
  set search_path = pg_catalog, public, extensions;

alter function public.recompute_trust_score(p_user uuid)
  set search_path = pg_catalog, public, extensions;

-- The places_nearby_with_name fn from 021 also gets the same treatment —
-- 021 originally shipped without a pinned path; this re-applies it the
-- same way so a fresh-clone replay produces the hardened state.
alter function public.places_nearby_with_name(
  double precision, double precision, double precision, double precision,
  text, real, integer
) set search_path = pg_catalog, public, extensions;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from public roles ---------
-- Triggers fire as the table owner regardless of EXECUTE perms, so this
-- only blocks the PostgREST RPC route — service_role can still invoke.

revoke execute on function public.bootstrap_first_admin()
  from anon, authenticated, public;

revoke execute on function public.delete_demo_data()
  from anon, authenticated, public;

revoke execute on function public.handle_new_user()
  from anon, authenticated, public;

revoke execute on function public.recompute_trust_score(uuid)
  from anon, authenticated, public;

-- 3. Drop dormant review-photos storage policies ----------------------------
-- Photos moved to Cloudinary in #45; bucket has been empty since. Without
-- these policies the bucket is service_role-only — a leftover empty
-- bucket is harmless (Dashboard can drop it later if you want).

drop policy if exists review_photos_public_read on storage.objects;
drop policy if exists review_photos_authenticated_write on storage.objects;
