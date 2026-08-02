# Deploy runbook — Neon + Vercel (Decisions 5, 20)

The repository is deploy-ready. The pipeline is the **Vercel Git integration**
(Decision 20): on every push, Vercel runs the build command from `vercel.json`:

```
npm run verify && npm run build && npm run db:migrate
```

`verify` (format, lint, typecheck, governance, dependency + security gates,
Tier 1 tests) → `next build` → migrations applied over the **direct** connection
under a PostgreSQL **advisory lock** (`tools/db-migrate.mjs`). A failed verify or
build produces no migration; a failed migration fails the build and blocks the
release. Node 24, region `iad1`, no Edge runtime.

> **One-way step:** the **first successful production build applies `0000` to the
> canonical Neon database and the migration chain freezes** (immutable after
> application, Decision 25). After that, schema changes are forward migrations
> only. The schema is settled (Step 3B review), so this is expected.

## What must be done in the provider consoles (account owner)

These require the owner's Neon/Vercel accounts and secrets and are done in the
web dashboards — not committed to the repo.

### 1. Neon (Decision 5)

1. Create a Neon project. Region: **AWS us-east-1** (matches the `iad1` Vercel
   region; keep them co-located).
2. Postgres **17**; enable the **PostGIS** extension is not required up front —
   the baseline migration runs `CREATE EXTENSION IF NOT EXISTS postgis` itself
   (Neon supports it).
3. Copy two connection strings from the project:
   - **Pooled** (host contains `-pooler`) → used as `DATABASE_URL`.
   - **Direct** (no `-pooler`) → used as `DATABASE_URL_DIRECT`.
4. (Optional, for preview isolation) enable Neon branching so each Vercel Preview
   gets its own branch; use that branch's pooled/direct strings for the Preview
   environment env vars.

### 2. Vercel (Decision 20)

1. Import the GitHub repo `gibouu/workincafe` into a Vercel project (Framework:
   Next.js — auto-detected). Leave the build command to `vercel.json`.
2. Set environment variables (Settings → Environment Variables):
   - **Production:** `DATABASE_URL` = Neon pooled (prod), `DATABASE_URL_DIRECT` =
     Neon direct (prod).
   - **Preview:** the Neon **branch** pooled/direct strings (or leave Preview
     unset until branching is configured — Preview builds will fail at the
     migrate step until they have a direct URL, which is the intended guardrail).
   - Do **not** set any `DATABASE_URL_TEST` in Vercel (tests are local-only).
   - **`GOOGLE_PLACES_SERVER_KEY`** (GP-1 seeding, slice 2 pt.3): a Google
     Cloud API key restricted to **Places API (New)**, set for **Production
     only** (Decision 20 — previews run billable server operations disabled;
     the seeding path fails closed with a clear message when the key is
     absent). Server-side secret — never a `NEXT_PUBLIC_*` variable. Google
     Cloud setup: one project, billing attached, "Places API (New)" enabled
     (the only API GP-1 needs; the Maps JavaScript API + separate browser key
     come later with the map slice), API-restricted key, budget alert
     recommended. Seeding uses the Text Search IDs-only field mask
     (Essentials SKU).
   - **`ANTHROPIC_API_KEY`** (Decision 27c — editorial AI pre-read): Anthropic
     API key, **Production only**, same fail-closed posture as the Google key.
     The assist path uses Place Details Pro/Enterprise SKU fields and photo
     media (billable per candidate pre-read) plus one Anthropic Messages call
     (`claude-opus-4-8`). Retain Anthropic's no-training/retention terms with
     the Decision 27 compliance records.
3. Keep the **registrar independent of Vercel** (Decision 20) — attach the
   `workin.cafe` domain later; do not transfer registration to Vercel.
4. Deploy `main`. The first production build migrates Neon and goes live.

### Preview isolation (Decision 20)

Preview deployments must never touch the production database. Two options:

- **Shared preview branch (current):** a Neon branch (`preview`) with its
  pooled/direct strings set as the Vercel **Preview** `DATABASE_URL` /
  `DATABASE_URL_DIRECT`. All previews share it; isolated from production.
- **Per-PR branches (Neon-Vercel integration):** in the **Neon console** →
  the `workincafe` project → Integrations → **Vercel** → connect the Vercel
  project and enable "create a branch for each preview deployment." This
  auto-provisions a fresh Neon branch per preview and manages the Vercel env
  vars. It sets the direct URL as `DATABASE_URL_UNPOOLED`; our migrate/config
  accept that name as well as `DATABASE_URL_DIRECT`. Configure it to avoid
  overwriting the working **Production** connection (scope to Preview, or verify
  the production values after connecting).

## Verifying a deploy

- Build logs show `verify` green, `next build`, then
  `db:migrate: OK — migration chain applied under advisory lock`.
- The live `/` lists published cafés; `/cafes/[slug]` renders detail; unknown/
  draft slugs 404. (Neon starts empty — seed real data via the operator/curation
  slice, not the local `db:seed:dev` fixtures.)

## Recovery — a `main` merge didn't deploy to production

The Git integration is correctly configured (production branch `main`; normal
merges auto-deploy). If a `main` merge does **not** produce a Production
deployment, this is almost always a one-off GitHub→Vercel **webhook delivery
miss**, not a misconfiguration (observed once, on #330). Do not change project
settings to chase it — recover by triggering a production build directly:

```
vercel --prod --yes
```

This uploads the current checkout and builds with the **Production** environment
(so it uses the prod database, not a preview branch), runs the same
`verify → build → db:migrate` pipeline, and promotes to the production alias;
`db:migrate` no-ops if the chain is already applied. Confirm with `vercel ls`
that the newest deployment is `Production` / `Ready`, then re-check the live
routes.

## Local development

`.env.local` (see `.env.example`) with a local Docker PostGIS URL; `npm run
db:migrate` / `db:seed:dev` / `db:test` all run locally. `db:migrate` acquires
the same advisory lock locally (harmless single-writer).

### Tier 2 database tests (local PostGIS)

`npm run db:test` runs the Tier 2 integration suite but does **not** start a
database — it expects a disposable local PostGIS at `DATABASE_URL_TEST` (the
`local-guard` refuses any hosted/non-local host). Bring one up with any runtime
that provides a Docker socket. On this machine that is **colima** (no Docker
Desktop):

```
# NOTE: the brew docker CLI is keg-only on this machine — put it on PATH first:
export PATH="/opt/homebrew/opt/docker/bin:$PATH"
colima start
docker run -d --name wc-test-pg \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=workincafe_test \
  -p 5432:5432 postgis/postgis:17-3.5
# Wait until it accepts a real connection — pg_isready races during the postgis
# image's init-restart, so gate on an actual connect, not just the open port.
DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:5432/workincafe_test \
  npm run db:test
```

The global setup drops the schema and migrates from empty once, then all files
run sequentially against that database. Tear down with `docker rm -f wc-test-pg`
(and `colima stop` to free the VM). Convention requires this before review on
schema-changing PRs (Decision 22).
