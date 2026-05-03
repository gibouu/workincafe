# Supabase init runbook

## 1 · Enable extensions (Dashboard)

Supabase Dashboard → **Database → Extensions** → enable:

- `uuid-ossp`
- `postgis`
- `pg_trgm`
- `pg_cron` (optional — only needed for `003_cron.sql`)

## 2 · Apply migrations

Copy each file into Supabase Dashboard → **SQL Editor** and run, in order:

| # | File                                  | What it does                                        |
|---|---------------------------------------|-----------------------------------------------------|
| 1 | `migrations/001_init.sql`             | tables, enums, RLS policies, triggers               |
| 2 | `migrations/002_views.sql`            | `mv_noise_heatmap`, `mv_current_live_status`, `mv_place_ratings`, `recompute_trust_score` |
| 3 | `migrations/003_cron.sql` *(optional)*| 15-minute `pg_cron` refresh of the three views      |
| 4 | `migrations/004_demo_mode.sql`        | `is_demo` columns + indexes + reset function        |
| 5 | `migrations/005_review_v2.sql`        | 1–10 rating scale, new collected fields, `review_photos` table |
| 6 | `migrations/006_owners_deals_loyalty.sql` | Place ownership claims, owner grants, deals (single + pack), purchases with QR, deal uses, point ledger |
| 7 | `migrations/007_friend_profiles.sql`  | Friend profile schema (occupation, work style, looking-for, identity, bio) |
| 8 | `migrations/008_stripe_connect.sql`   | `stripe_accounts`, `stripe_events`, payment lifecycle columns on `deal_purchases` |

Or use the CLI from the repo root:

```bash
npx supabase link --project-ref ndsrmsfqzkwbkzgkyrxr
npx supabase db push
```

## 2.5 · Create the review-photos Storage bucket

Dashboard → **Storage → New bucket**:

- **Name:** `review-photos`
- **Public:** yes (read-only public; writes are RLS-gated)
- **Allowed mime types:** `image/jpeg, image/png, image/webp`
- **File size limit:** 5 MB

Bucket policies (Storage → Policies → `review-photos`):

```sql
-- Public read
create policy "review_photos_public_read" on storage.objects for select
  using (bucket_id = 'review-photos');

-- Authenticated write into a path scoped to the user's review id
create policy "review_photos_authenticated_write" on storage.objects for insert
  with check (bucket_id = 'review-photos' and auth.role() = 'authenticated');
```

If the bucket is not present, photo uploads fail silently and the review is still saved (the form surfaces a toast).

## 2.6 · Create the claim-proofs Storage bucket

Dashboard → **Storage → New bucket**:

- **Name:** `claim-proofs`
- **Public:** **no** (private; admin reads via signed URL)
- **Allowed mime types:** `image/jpeg, image/png, image/webp, application/pdf`
- **File size limit:** 10 MB

Bucket policies:

```sql
-- Authenticated users can upload to a path under their own uid
create policy "claim_proofs_authenticated_write" on storage.objects for insert
  with check (bucket_id = 'claim-proofs' and auth.role() = 'authenticated');

-- Owners read their own; admins read all (admin signing happens server-side)
create policy "claim_proofs_read_own" on storage.objects for select
  using (
    bucket_id = 'claim-proofs'
    and (auth.uid()::text = (storage.foldername(name))[1]
         or exists (select 1 from public.users where id = auth.uid() and is_admin))
  );
```

## 3 · Enable auth providers

Dashboard → **Authentication → Providers**:

- **Google** — paste Client ID + Client Secret from Google Cloud Console OAuth credentials.
- **Apple** — paste the Services ID + Key ID + Team ID + `.p8` contents.

Allow-list redirect URIs:

- `http://localhost:3000/auth/callback`
- `https://workin.cafe/auth/callback`

## 4 · Seed places (after migrations applied)

```bash
pnpm seed:paris
npx tsx scripts/seed-osm.ts toronto
```

Expected: ~1,000 Paris + ~900 Toronto quality places after dedup.

## 5 · Regenerate typed DB (optional but nice)

```bash
npx supabase gen types typescript --linked > types/database.ts
```

Then re-add the `<Database>` generic in `lib/supabase/{client,server}.ts` + `lib/supabase/admin.ts`.

## 6 · Run a pg_cron refresh manually (if you skipped 003)

```sql
refresh materialized view concurrently public.mv_noise_heatmap;
refresh materialized view concurrently public.mv_current_live_status;
refresh materialized view concurrently public.mv_place_ratings;
```

## 7 · Make yourself an admin

```sql
update public.users set is_admin = true where id = '<your auth user uuid>';
```

---

Until step 2 is done, every `/api/*` route returns either empty arrays (reads) or a graceful 503 / 401 (writes). The demo data path (Paris/Toronto hardcoded) keeps working regardless.
