-- 006: Place ownership claims, owner grants, deals, deal purchases (with QR
-- payload for in-platform payment), per-scan deal uses, and the loyalty point
-- ledger.
--
-- Anti-platform invariants this schema enforces:
--   * point_events insert has NO public RLS policy — only the service role
--     (server actions) issues points. Users cannot self-issue.
--   * deal_purchases.uses_remaining is decremented server-side per scan; one
--     RLS-gated owner-only update permits this.
--   * place_owners is the single gate for owner-only writes (deals, scans).

-- =========================================================================
-- 1. Place ownership claims
-- =========================================================================
create table if not exists public.place_claims (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  claimant_user_id uuid not null references public.users(id) on delete cascade,
  claimant_email text not null,
  claimant_name text,
  proof_type text not null check (proof_type in ('storefront_photo','business_doc','website_email','other')),
  proof_path text,
  proof_notes text,
  status request_status default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  is_demo boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists place_claims_place_idx on public.place_claims (place_id);
create index if not exists place_claims_user_idx on public.place_claims (claimant_user_id);
create index if not exists place_claims_status_idx on public.place_claims (status);
create index if not exists place_claims_is_demo_idx on public.place_claims (is_demo) where is_demo = true;

alter table public.place_claims enable row level security;

drop policy if exists "claims_read_own_or_admin" on public.place_claims;
create policy "claims_read_own_or_admin" on public.place_claims for select using (
  claimant_user_id = auth.uid()
  or exists (select 1 from public.users where id = auth.uid() and is_admin)
);

drop policy if exists "claims_insert_own" on public.place_claims;
create policy "claims_insert_own" on public.place_claims for insert
  with check (claimant_user_id = auth.uid());

drop policy if exists "claims_admin_update" on public.place_claims;
create policy "claims_admin_update" on public.place_claims for update using (
  exists (select 1 from public.users where id = auth.uid() and is_admin)
);

-- =========================================================================
-- 2. Owner grants (multi-owner per place; soft revoke)
-- =========================================================================
create table if not exists public.place_owners (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  granted_at timestamptz default now(),
  revoked_at timestamptz,
  granted_by uuid references public.users(id),
  is_demo boolean not null default false
);

create unique index if not exists place_owners_active_unique
  on public.place_owners (place_id, user_id)
  where revoked_at is null;

create index if not exists place_owners_user_idx on public.place_owners (user_id) where revoked_at is null;
create index if not exists place_owners_place_idx on public.place_owners (place_id) where revoked_at is null;

alter table public.place_owners enable row level security;

drop policy if exists "owners_read_all" on public.place_owners;
create policy "owners_read_all" on public.place_owners for select using (true);

-- Inserts/updates only via service role (admin approval).

-- =========================================================================
-- 3. Deals (offer template)
-- =========================================================================
create table if not exists public.deals (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  created_by uuid not null references public.users(id),
  title text not null,
  description text,
  kind text not null check (kind in ('single_use','pack')),
  pack_size int not null default 1 check (pack_size between 1 and 100),
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'EUR',
  starts_at timestamptz default now(),
  ends_at timestamptz,
  purchase_limit_per_user int,
  active boolean default false,
  is_demo boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists deals_place_idx on public.deals (place_id);
create index if not exists deals_active_idx on public.deals (place_id, active) where active = true;
create index if not exists deals_is_demo_idx on public.deals (is_demo) where is_demo = true;

alter table public.deals enable row level security;

drop policy if exists "deals_read_active_or_owner" on public.deals;
create policy "deals_read_active_or_owner" on public.deals for select using (
  active = true
  or exists (
    select 1 from public.place_owners
    where place_id = deals.place_id and user_id = auth.uid() and revoked_at is null
  )
  or exists (select 1 from public.users where id = auth.uid() and is_admin)
);

drop policy if exists "deals_owner_write" on public.deals;
create policy "deals_owner_write" on public.deals for all using (
  exists (
    select 1 from public.place_owners
    where place_id = deals.place_id and user_id = auth.uid() and revoked_at is null
  )
  or exists (select 1 from public.users where id = auth.uid() and is_admin)
) with check (
  exists (
    select 1 from public.place_owners
    where place_id = deals.place_id and user_id = auth.uid() and revoked_at is null
  )
  or exists (select 1 from public.users where id = auth.uid() and is_admin)
);

-- =========================================================================
-- 4. Purchases (one ticket per purchase; QR payload + uses_remaining)
-- =========================================================================
create table if not exists public.deal_purchases (
  id uuid primary key default uuid_generate_v4(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  place_id uuid not null references public.places(id),
  user_id uuid not null references public.users(id) on delete cascade,
  qr_code text not null unique,
  uses_total int not null check (uses_total >= 1),
  uses_remaining int not null check (uses_remaining >= 0),
  amount_paid_cents int not null check (amount_paid_cents >= 0),
  currency text not null default 'EUR',
  payment_method text not null default 'demo',
  payment_intent_id text,
  is_demo boolean not null default false,
  purchased_at timestamptz default now(),
  expires_at timestamptz
);

create index if not exists deal_purchases_user_idx on public.deal_purchases (user_id);
create index if not exists deal_purchases_place_idx on public.deal_purchases (place_id);
create index if not exists deal_purchases_qr_idx on public.deal_purchases (qr_code);
create index if not exists deal_purchases_is_demo_idx on public.deal_purchases (is_demo) where is_demo = true;

alter table public.deal_purchases enable row level security;

drop policy if exists "purchases_read_self_or_owner" on public.deal_purchases;
create policy "purchases_read_self_or_owner" on public.deal_purchases for select using (
  user_id = auth.uid()
  or exists (
    select 1 from public.place_owners
    where place_id = deal_purchases.place_id and user_id = auth.uid() and revoked_at is null
  )
);

drop policy if exists "purchases_insert_self" on public.deal_purchases;
create policy "purchases_insert_self" on public.deal_purchases for insert
  with check (user_id = auth.uid());

-- Update only via service role (uses_remaining decrement on scan).

-- =========================================================================
-- 5. Deal uses (each scan-and-redeem, owner action)
-- =========================================================================
create table if not exists public.deal_uses (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid not null references public.deal_purchases(id) on delete cascade,
  scanned_by uuid not null references public.users(id),
  scanned_at timestamptz default now(),
  notes text,
  is_demo boolean not null default false
);

create index if not exists deal_uses_purchase_idx on public.deal_uses (purchase_id);
create index if not exists deal_uses_is_demo_idx on public.deal_uses (is_demo) where is_demo = true;

alter table public.deal_uses enable row level security;

drop policy if exists "uses_read_self_or_owner" on public.deal_uses;
create policy "uses_read_self_or_owner" on public.deal_uses for select using (
  exists (
    select 1 from public.deal_purchases p
    where p.id = deal_uses.purchase_id and p.user_id = auth.uid()
  )
  or scanned_by = auth.uid()
);

-- Inserts via service role only (server validates ticket + decrements uses).

-- =========================================================================
-- 6. Point ledger (events, not balance)
-- =========================================================================
create table if not exists public.point_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('earned_use','spent_freebie','adjusted','expired')),
  delta int not null,
  related_use_id uuid references public.deal_uses(id),
  related_purchase_id uuid references public.deal_purchases(id),
  related_place_id uuid references public.places(id),
  related_deal_id uuid references public.deals(id),
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists point_events_user_idx on public.point_events (user_id);
create index if not exists point_events_kind_idx on public.point_events (kind);

alter table public.point_events enable row level security;

drop policy if exists "points_read_own" on public.point_events;
create policy "points_read_own" on public.point_events for select using (user_id = auth.uid());

-- No insert/update/delete policies — server-only via service role.

-- =========================================================================
-- 7. Helper: balance per user
-- =========================================================================
create or replace function public.user_point_balance(uid uuid)
  returns int language sql stable as $$
  select coalesce(sum(delta), 0)::int
    from public.point_events
   where user_id = uid;
$$;
