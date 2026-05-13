-- Migration 025 — places.membership_required (#127)
--
-- Optional human-readable note when a place has a membership / paywall.
-- Examples: "Members only", "Café area open to all; gym members only",
-- "Day pass available". NULL = no paywall (the vast majority of rows).
--
-- We store the note as text (not a boolean + enum) because the nuance
-- matters — Annette K's café is open to all but the gym is members-
-- only; Soho House is fully gated; Anticafé members-area is buyable
-- by the hour. A single human-readable string lets the place card
-- surface what the user actually needs to know.
--
-- The column is nullable and additive; no backfill required. Existing
-- 60k+ rows stay as-is. Curated TS file (lib/curated/workspace-gyms.ts)
-- populates this via the seed-curated-workspaces script.

set search_path = public, extensions;

alter table public.places
  add column if not exists membership_required text;

comment on column public.places.membership_required is
  'Human-readable note for places gated behind a paywall (members only / day pass / etc.). NULL = no paywall. See #127.';
