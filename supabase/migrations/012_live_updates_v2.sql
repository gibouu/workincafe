-- 012: live_updates additions for the 2-page wizard.
--
-- Adds the new fields the rewritten LiveUpdateSheet collects:
--   - outlets: 3-bucket level (many / some / none) — same coarse buckets
--     as the other "right now" enums.
--   - rotating_question / rotating_answer: optional one-off question shown
--     to the user, varies per place. Stored as free text so the prompt
--     text can evolve without a schema change.
--
-- The pre-existing columns (noise_level, seating_availability, temperature)
-- stay as-is — they're still the canonical "right now" values surfaced on
-- place cards via mv_recent_live_updates.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'outlets_level') then
    create type public.outlets_level as enum ('many', 'some', 'none');
  end if;
end$$;

alter table public.live_updates
  add column if not exists outlets public.outlets_level,
  add column if not exists rotating_question text,
  add column if not exists rotating_answer text;
