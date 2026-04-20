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

Or use the CLI from the repo root:

```bash
npx supabase link --project-ref ndsrmsfqzkwbkzgkyrxr
npx supabase db push
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
