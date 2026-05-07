-- Cron helper functions for the nightly maintenance routes. See #23.
--
-- Idempotent.
--
-- `cron_expire_loyalty()` performs the loyalty expiry sweep in a single SQL
-- pass and returns `{ rows_expired }`. Called from
-- /api/cron/expire-loyalty (gated by CRON_SECRET / x-vercel-cron).

create or replace function public.cron_expire_loyalty()
  returns table(rows_expired int)
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  inserted_count int;
begin
  with totals as (
    select
      user_id,
      sum(case when kind = 'earned_use' and created_at < now() - interval '12 months'
               then delta else 0 end) as old_earned,
      sum(case when kind = 'expired' then -delta else 0 end) as already_expired,
      sum(delta) as current_balance
    from public.point_events
    where is_demo = false
    group by user_id
  ),
  candidates as (
    select
      user_id,
      least(
        greatest(coalesce(old_earned, 0) - coalesce(already_expired, 0), 0),
        coalesce(current_balance, 0)
      )::int as expire_amount
    from totals
  ),
  inserted as (
    insert into public.point_events (user_id, kind, delta, notes)
    select user_id, 'expired', -expire_amount, 'Annual loyalty expiry sweep'
    from candidates
    where expire_amount > 0
    returning id
  )
  select count(*) into inserted_count from inserted;
  rows_expired := inserted_count;
  return next;
end;
$$;

revoke all on function public.cron_expire_loyalty() from public;
revoke all on function public.cron_expire_loyalty() from anon;
revoke all on function public.cron_expire_loyalty() from authenticated;
-- Service role keeps execute by default (security definer + the cron route
-- is the only caller).
