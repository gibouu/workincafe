-- 008: Stripe Connect Express integration. Schema-only — application code
-- branches on STRIPE_SECRET_KEY (env). When unset, the existing demo path
-- runs unchanged.

-- =========================================================================
-- 1. Owner Stripe accounts
--
-- Stripe Connect data is per-USER, not per-place: one onboarding =
-- one stripe_account_id, used for all places that user owns. We keep it on
-- a separate table so we don't bloat users.
-- =========================================================================
create table if not exists public.stripe_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  country text,
  default_currency text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists stripe_accounts_payouts_idx
  on public.stripe_accounts (payouts_enabled) where payouts_enabled = true;

alter table public.stripe_accounts enable row level security;

drop policy if exists "stripe_accounts_read_own" on public.stripe_accounts;
create policy "stripe_accounts_read_own" on public.stripe_accounts for select
  using (user_id = auth.uid());
-- Inserts/updates via service role only (server-side after Stripe API calls).

-- =========================================================================
-- 2. deal_purchases — payment lifecycle columns
-- =========================================================================
alter table public.deal_purchases
  add column if not exists payment_status text not null default 'paid'
    check (payment_status in ('pending','paid','refunded','failed','disputed')),
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_amount_cents int check (refund_amount_cents >= 0),
  add column if not exists application_fee_cents int check (application_fee_cents >= 0);

create index if not exists deal_purchases_payment_status_idx
  on public.deal_purchases (payment_status);

-- =========================================================================
-- 3. Webhook idempotency
--
-- Stripe retries webhooks aggressively (1-2 days, exponential backoff). We
-- record every received event.id and skip duplicates. Cleaning up older
-- rows is a follow-up cron job.
-- =========================================================================
create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  livemode boolean not null,
  payload_summary jsonb,
  processed_at timestamptz default now(),
  error text
);

create index if not exists stripe_events_type_idx on public.stripe_events (event_type);
create index if not exists stripe_events_processed_at_idx on public.stripe_events (processed_at);

alter table public.stripe_events enable row level security;
-- Read by admin only; inserts via service role.
drop policy if exists "stripe_events_admin_read" on public.stripe_events;
create policy "stripe_events_admin_read" on public.stripe_events for select using (
  exists (select 1 from public.users where id = auth.uid() and is_admin)
);

-- updated_at trigger for stripe_accounts
create or replace function public.touch_stripe_accounts_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stripe_accounts_touch on public.stripe_accounts;
create trigger stripe_accounts_touch
  before update on public.stripe_accounts
  for each row execute function public.touch_stripe_accounts_updated_at();
