# Operative decision records — Decisions 2–5: runtime, data requirements, database

## Decision 2 — Runtime and package manager (approved 2026-07-22)

Node.js **24.x**, pinned in `package.json` engines, Vercel project
settings, `.nvmrc`/local config, and migration/operator scripts. Vercel-
managed minors/patches accepted; no indefinite patch freeze; the actual
version used is recorded and verified during builds. Node 26 is not used
while it remains non-LTS/non-default unless explicitly reconsidered.
Package manager: **npm 11** (bundled). One committed `package-lock.json`;
`npm ci` for CI/deployment validation; the lockfile may not mutate
unnoticed; expected npm major declared where useful; foreign lockfiles
(`pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`) rejected. **Corepack is not
used.** pnpm revisited only on monorepo need or a demonstrated npm
limitation, with Vercel support confirmed then.

## Decision 3 — Logical data requirements (ratified 2026-07-22, amended by D9)

Canonical records are **WorkinCafe-controlled canonical records containing
properly licensed, attributed or independently recorded facts.** Domains:
canonical place records; external source references (permitted source
types include Google Place IDs as discovery-only provenance, Overture
identifiers, Toronto Open Data identifiers, curator and community
provenance); study attributes (Wi-Fi, power outlets, noise, seating) with
**unknown ≠ negative**, provenance classes, confidence, and freshness
timestamps; a candidate queue defined by the GP-1-led inclusion flow;
launch boundary (City of Toronto); operator identity; curation events.
Invariants: imports never silently overwrite human-curated data; import
conflicts create review candidates; external status signals create review
tasks, never automatic closure/deletion; provenance/licence traceability;
observation history is **append-only from day one** (observed value,
source/observer, observation time, verification/moderation state,
relationship to current effective value — physical representation
deferred). **No canonical product-type field** at launch; source
categories stay in matching/ingestion metadata. **Lightweight curation
event history** for significant operator actions (approve/reject,
publish/unpublish, close/reopen, merge, material attribute changes) with
operator + timestamp + context; not event-sourcing. Hours: structured with
first-class unknown; never required for publication. Non-requirements:
multi-region, horizontal scaling, realtime, queues, search-relevance
engines, per-user data at launch, multi-city machinery.

## Decision 4 — Database engine (approved 2026-07-23)

**PostgreSQL**, as a greenfield decision. Grounds: relational
integrity/constraints, managed-provider breadth, serverless connection
maturity, full-fidelity export/portability, typed-tooling support, no need
for a remote-SQLite service model. Recorded analysis corrections: SQLite
does support transactional schema changes; its FK enforcement is
per-connection opt-in; limited `ALTER TABLE` and serverless fit remain its
honest disadvantages. Version policy: latest stable **non-preview** major
officially supported by the selected host at foundation-database creation;
host-managed minors; exact major recorded; local dev and CI aligned to the
production major; no silent major changes on provider defaults.

## Decision 5 — Database hosting and geospatial (approved 2026-07-23)

Host: **Neon** (direct account, not marketplace-billed). Geospatial:
**PostgreSQL + PostGIS**, proportionate use only (bounding-box queries,
distance ordering, Toronto-boundary containment); no routing, topology, or
geometry editing; the database remains portable to ordinary
PostgreSQL/PostGIS. Version at this ruling: PostgreSQL **17** (Neon
classified PG18 as preview; re-verify at implementation; availability ≠
stability).

Bindings:

- **Target requirement:** Neon organization/project ownership and recovery
  must not depend on one unrecoverable personal account; both developers
  hold the administrative access their responsibilities require. The
  required access state is verified during the applicable setup step; this
  record makes no claim that it is already satisfied.
- Nearest suitable US-East region; Vercel Functions region aligned after
  verifying the current mapping (no reliance on future defaults).
- Distinct connection roles: pooled URL for application traffic; direct
  URL for migrations, schema administration, dumps/restores, maintenance
  (names `DATABASE_URL` / `DATABASE_URL_DIRECT`). Secrets only in approved
  stores. Spending controls when (and only when) a usage-based plan
  exists.
- Branching is an available tool, not a mandatory PR workflow. The
  migration chain must be reproducible from empty in the pinned
  PostgreSQL 17 plus PostGIS environment. At launch, full
  migrate-from-empty and database integration verification runs through
  the convention-enforced local Tier 2 command defined by Decision 22.
  Preview migration success is an additional smoke check, not a substitute
  for Tier 2. Automated database-backed CI is deferred.
- **5-BK (SUPERSEDED by Decision 19a):** external backup automation is
  _deferred and explicitly not implemented at launch_. Neon-provider
  recovery is accepted for the current no-user, low-value-data stage.
  Independent external backups require a new decision when a recorded
  reconsideration trigger is reached (triggers in source/09).
- 5e legacy database sequence: produce the **sanitized** archive (0a
  exclusions, field-level derived values included in the exclusion
  procedure) → verify restorability in a disposable local
  PostgreSQL/PostGIS environment → preserve privately with access controls
  → establish and validate the new Neon baseline (Step 3B) → confirm
  nothing required remains solely in the legacy project → pause, then
  decommission. Never decommission before a validated retained archive
  exists.
- Supabase recorded as a technically valid alternative (documented
  fallback, inactive).
