-- Migration 024 — restore review submission after #112 hardening (#140)
--
-- Problem
-- =======
-- Migration 022_security_hardening revoked EXECUTE on
-- public.recompute_trust_score() from `authenticated` so it can't be
-- called as an RPC. The comment in 022 assumed triggers would still
-- work because the function is SECURITY DEFINER — but Postgres still
-- checks EXECUTE permission against the *trigger caller* when the
-- trigger function itself isn't SECURITY DEFINER. The trigger
-- `reviews_update_trust` was plain SECURITY INVOKER, so every review
-- insert from an authenticated user failed with:
--
--   permission denied for function recompute_trust_score
--
-- Fix
-- ===
-- Mark `reviews_update_trust` SECURITY DEFINER + pinned search_path,
-- and revoke EXECUTE so direct RPC calls still can't reach it. The
-- trigger path now runs as the function owner (postgres), which has
-- EXECUTE on recompute_trust_score by default.
--
-- This preserves the intent of #112 (no client-callable RPC for the
-- privileged trust-score recompute) while restoring review writes.

set search_path = pg_catalog, public, extensions;

alter function public.reviews_update_trust() security definer
  set search_path = pg_catalog, public, extensions;

revoke execute on function public.reviews_update_trust()
  from anon, authenticated, public;
