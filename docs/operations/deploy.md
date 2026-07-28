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
3. Keep the **registrar independent of Vercel** (Decision 20) — attach the
   `workin.cafe` domain later; do not transfer registration to Vercel.
4. Deploy `main`. The first production build migrates Neon and goes live.

## Verifying a deploy

- Build logs show `verify` green, `next build`, then
  `db:migrate: OK — migration chain applied under advisory lock`.
- The live `/` lists published cafés; `/cafes/[slug]` renders detail; unknown/
  draft slugs 404. (Neon starts empty — seed real data via the operator/curation
  slice, not the local `db:seed:dev` fixtures.)

## Local development (unchanged)

`.env.local` (see `.env.example`) with a local Docker PostGIS URL; `npm run
db:migrate` / `db:seed:dev` / `db:test` all run locally. `db:migrate` acquires
the same advisory lock locally (harmless single-writer).
