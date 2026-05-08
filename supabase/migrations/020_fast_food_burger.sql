-- 020: Add 'fast_food_burger' to place_category. See #80.
--
-- Schema-only. The data backfill for existing `category='fast_food'` rows
-- lives in supabase/scripts/split-fast-food.sql — run it AFTER this
-- migration applies. Keeping the two separate avoids the Postgres rule
-- that an enum value added in a transaction can't be used in DML in the
-- same transaction.
--
-- Idempotent: `add value if not exists` no-ops on re-apply.

set search_path = public, extensions;

alter type place_category add value if not exists 'fast_food_burger' before 'other';
