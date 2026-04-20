-- Work in Cafe — pg_cron schedule (optional, run after 002_views.sql).
--
-- Prereq: enable pg_cron in Supabase Dashboard → Database → Extensions.
-- If you skip this file, refresh the materialized views manually or via a
-- Vercel/GitHub Action cron that calls a protected endpoint.

create extension if not exists pg_cron;

do $$ begin
  perform cron.unschedule('wic-refresh-views');
exception when others then null; end $$;

select cron.schedule(
  'wic-refresh-views',
  '*/15 * * * *',
  $$
  refresh materialized view concurrently public.mv_noise_heatmap;
  refresh materialized view concurrently public.mv_current_live_status;
  refresh materialized view concurrently public.mv_place_ratings;
  $$
);
