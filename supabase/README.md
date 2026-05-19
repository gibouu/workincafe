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
| 9 | `migrations/009_admin_bootstrap.sql`  | First user signed in is auto-promoted to admin (advisory-locked) |
| 10 | `migrations/010_review_photos_cloudinary.sql` | Cloudinary public_id columns on `review_photos` |
| 11 | `migrations/011_review_provenance.sql` | `source` + `source_weight` on reviews; reweighted `mv_place_ratings` |
| 12 | `migrations/012_live_updates_v2.sql`  | LiveUpdate wizard schema additions (#13 / #30) |
| 13 | `migrations/013_review_upscale_marker.sql` | `upscaled_at` marker column on reviews — see runbook below (#24) |
| 14 | `migrations/014_cron_helpers.sql`     | `cron_expire_loyalty()` SECURITY DEFINER function called by the nightly Vercel Cron route (#23) |
| 15 | `migrations/015_owner_menus.sql`      | Owner-uploaded menus and metadata |
| 16 | `migrations/016_place_menus_file_kind.sql` | Menu file kind metadata |
| 17 | `migrations/017_place_menus_visibility.sql` | Menu visibility controls |
| 18 | `migrations/018_user_rating_count.sql` | User rating count support |
| 19 | `migrations/019_coffee_review_signals.sql` | Coffee review signal fields and ratings updates |
| 20 | `migrations/020_fast_food_burger.sql` | Fast-food burger category support |
| 21 | `migrations/021_user_validated_places.sql` | User-validated place tracking |
| 22 | `migrations/022_security_hardening.sql` | Security hardening changes |
| 23 | `migrations/023_parent_place_id.sql`  | Parent/child place relationships |
| 24 | `migrations/024_review_trigger_security_definer.sql` | Review trigger security definer update |
| 25 | `migrations/025_membership_required.sql` | Membership-required place metadata |
| 26 | `migrations/026_admin_users_with_emails.sql` | Admin user email lookup support |
| 27 | `migrations/027_merge_places.sql`     | Admin place merge RPC |
| 28 | `migrations/20260519004310_clawpatch_findings_fix.sql` | Clawpatch follow-up fixes for RLS, cron, merge, Wi-Fi RPC, and source enums |

> **`Could not find the table 'public.friend_profiles'`** in your logs is expected when migration 007 hasn't been applied yet. The friend-profile API soft-handles it (returns an empty profile + the wizard renders cleanly). Apply 007 to make the error go away.

Or use the CLI from the repo root:

```bash
npx supabase link --project-ref ngpgpxgbcjdmcgipqhtl
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
npm run seed:paris
npm run seed:toronto
```

Expected: ~1,000 Paris + ~900 Toronto quality places after dedup. The seed
applies a **work-conducive hours filter** (`lib/places/work-conducive.ts`)
that drops dinner-only and split-shift restaurants/fast-food. Cafés,
bakeries, libraries, coworking spaces, and hotels are kept regardless of
hours.

### 4.1 · Pruning already-seeded restaurants

If you seeded before the hours filter existed, run the prune script:

```bash
npm run prune:hours -- --dry-run   # preview the kill list (count + sample)
npm run prune:hours                # commit the deletions
```

The script protects any place with reviews, check-ins, or live updates so
user contributions are never destroyed. The seed is idempotent
(`normalized_name_hash` dedup), so re-running it after a prune is safe and
will refresh anything new the filter now permits.

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

## 8 · One-shot: upscale legacy 1–5 ratings to 1–10 (when needed)

The 1–10 scale shipped in `005_review_v2.sql`; rows older than that sit
in the lower half of the new range and the smoothing in
`mv_place_ratings` absorbs the drift. Run this only when aggregate
scores on the place card start to look visibly off.

1. Apply `migrations/013_review_upscale_marker.sql` (adds `reviews.upscaled_at`).
2. Open `scripts/upscale-legacy-ratings.sql`, edit the `legacy_cutover` value to the timestamp the 1–10 form went live in production.
3. Run the file in **Supabase Dashboard → SQL Editor**. The script previews the candidate count via `RAISE NOTICE` before the UPDATE; review and `ROLLBACK` if the number looks off.
4. The script ends with `REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_place_ratings;` so the place cards reflect the new averages immediately.

The `upscaled_at IS NULL` filter prevents double-running, so re-applying
the script is a no-op once the rows are upscaled.

---

Until step 2 is done, every `/api/*` route returns either empty arrays (reads) or a graceful 503 / 401 (writes). The demo data path (Paris/Toronto hardcoded) keeps working regardless.
