# Operative decision records — Decisions 6–7: data access and migrations

## Decision 6 — Data-access strategy (approved 2026-07-23)

**Drizzle ORM + Drizzle Kit** (stable line; Drizzle 1.0 excluded while
beta/RC — future adoption is a separate reviewed upgrade running
generation, migrate-from-empty, type checking, and integration tests),
with the **`pg`** driver via Drizzle's node-postgres adapter. Deliberate
technology choice, including experience-building; judged fully capable of
the approved workload.

Coverage: public place reads, dynamic viewport/attribute-filter queries,
detail reads, admin curation, observation writes, review queues, curation
history, operator ingestion tooling where appropriate.

Schema truth (TS-schema-first, clarified): Drizzle TypeScript schema files
are the primary application-level schema definition; generated SQL
migrations are the immutable, reviewed artifacts applied to PostgreSQL;
**the actual migrated PostgreSQL database remains the runtime enforcement
authority**; custom SQL migrations are allowed where Drizzle's DSL cannot
represent a feature (extensions, functions, triggers, constraints, views,
special indexes) — committed in the same ordered chain, documented near
the relevant schema, reproducible from empty, tested where they enforce
product invariants, never silently removed because the diff tool doesn't
model them. An empty regeneration diff alone never proves database
equivalence. No parallel handwritten table interfaces outside Drizzle's
inferred types.

Connections: pooled connection for normal application traffic (public
reads, admin reads/writes, review/publication workflows, ordinary
transactions); direct connection for migrations, extension/schema
administration, `pg_dump`/restore, maintenance, and operator CLIs only
when session-level behavior is genuinely needed. One reusable `pg` pool
per server runtime instance. `@neondatabase/serverless` is **not**
adopted; it may be evaluated later only behind the data-access boundary
with measured justification (deferred register).

Spatial: one small reviewed spatial-query module using parameterized SQL
templates; typed inputs and outputs; rejects arbitrary SQL fragments;
integration-tested against PostgreSQL 17 + PostGIS; no raw spatial SQL in
routes or components.

Version posture: latest stable non-preview versions of drizzle-orm,
drizzle-kit, `pg`, and adapters at foundation-PR time; exact versions in
lockfile and dependency register.

Canonical exemplars (mandatory, added with their slices): simple typed
select; transactional write; dynamic filter query; PostGIS query; custom-
SQL migration; ingestion-boundary validation. GP-1 boundary: an IDs-only
response is validated before reaching any general persistence function;
Google-sourced payload types contain no writable café fields.

## Decision 7 — Migration workflow (approved 2026-07-23; execution amended by Decision 20)

Workflow everywhere: edit schema → generate migration → review SQL →
migrate database. **`drizzle-kit push` is prohibited as a normal workflow
in every environment, including local development; no `db:push` script
ever exists.** Enforced mechanically: no push script; verification rejects
remote-push scripts/workflows; shared database credentials unavailable to
schema-generation contexts; production secrets exist only in the protected
environment.

Immutability and rollback: forward-only; applied migrations are never
edited, reordered, renamed, or deleted — corrections via subsequent
migrations. Pre-baseline squashing is allowed through reviewed change
until the Step 3B baseline applies to canonical Neon (any non-disposable
dev database on the old chain is explicitly reset); the chain then freezes
permanently. Roll-forward is the normal correction; backup restoration is
disaster recovery, not schema rollback. Verified backup before destructive
or hard-to-reverse migrations. Once normal deployment begins, schema
changes follow expand/contract where compatibility is required: add
structures → deploy transitional code → backfill separately → remove
obsolete structures in a later reviewed migration. The baseline may
contain `CREATE EXTENSION postgis`, the initial Drizzle-representable
schema, required custom PostgreSQL/PostGIS objects, and migration-tracking
setup.

Configuration: one committed migration directory; Drizzle journal and
default tracking table unless a concrete conflict appears; generated and
custom migrations in one ordered chain; descriptive names; custom SQL
migrations self-identify purpose. `db:generate` works with **no**
`DATABASE_URL_DIRECT`; `db:migrate` fails clearly without it; the
production direct URL is never exposed to generation, linting,
type-checking, preview-build, or ordinary verification contexts; local
and CI migration commands use disposable local PostGIS URLs; the same
committed artifacts are applied locally and to Neon.

**SUPERSEDED (by Decision 20):** the originally approved dedicated GitHub
Actions migration workflow (manual `workflow_dispatch`, GitHub `production`
environment) and the originally approved standalone per-PR CI verification
workflow are superseded. Migration execution now runs inside the canonical
Vercel build command — verification → `next build` → environment-aware
migration under a PostgreSQL advisory lock (bounded wait; released on
success and failure; already-applied migrations are no-ops; the committed
journal is the ordering source) over the direct connection; a failed
verification or build produces no migration; a failed migration prevents
deployment release; migrations never run at application startup or request
time; the previously deployed application must remain compatible with
every newly applied migration. See source/09 (Decision 20).
