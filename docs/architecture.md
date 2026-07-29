# Architecture

Status: **foundation + database baseline implemented** (Step 2B + 3A + 3B). The
approved directory structure, toolchain, enforcement, and the canonical database
schema (Drizzle + PostGIS + Better Auth, first frozen migration) are in place;
feature code lands per vertical slice (Step 4).
The authoritative detail lives in the operative decision records (13, 15, 16, 17, 18)
under `docs/decisions/source/`; this file is the working map.

## Directory structure (Decision 13a — no `src/`)

```
app/(public)            public anonymous experience (home shell today)
app/(operator)/admin    auth-gated curation console
app/(operator)/gp1      auth-gated, MAPLESS candidate-seeding surface
app/api                 thin Route Handlers (interactive client reads only)
components/{ui,map,list,place,search,admin,gp1}
lib/domain              pure TypeScript rules/types (no IO/framework)
lib/application         use cases / orchestration; returns narrow DTOs
lib/db                  Drizzle schema, queries, spatial module (server-only)
lib/auth                Better Auth config + operator authorization (server-only)
lib/integrations/google/client   browser-safe Maps only
lib/integrations/google/server   server-only Places callers + DTO mapping
lib/integrations/overture        matching-index tooling
lib/ingestion           operator-run ingestion/curation adapters
lib/flags               typed feature-flag registry
lib/contracts/http      browser-safe HTTP wire contracts
lib/env                 split server.ts / public.ts validation
lib/client-state        URL-first committed state + ephemeral helpers
tests/{unit,contracts,boundaries,compliance,integration}
drizzle                 committed SQL migrations (empty until Step 3B)
tools                   governance-check.sh, check-dependencies.mjs
```

Each module carries a `README.md` stating its responsibility. Directories are populated
only by their approved slice; empty modules hold only the README until then.

## Dependency directions (Decision 13b — enforced by ESLint `no-restricted-imports`)

domain → nothing · db / auth-server / google-server / overture / ingestion → domain ·
application → domain + narrow infrastructure · google/client → browser-safe shared types ·
components → domain types + application DTOs + google/client (map only) · app →
application + components + approved auth entry points · scripts → application/ingestion.

Enforced prohibitions (see `eslint.config.mjs` and source/07): components never import
`lib/db` or `lib/integrations/google/server`; the Google client never imports server
modules/credentials; `lib/domain` imports no framework/IO/app/UI; routes/pages never
touch `lib/db` directly (go through `lib/application`); the GP-1 surface never imports map
components or the Maps client. Additional boundary/compliance checks that ESLint cannot
express become tests under `tests/boundaries` and `tests/compliance` as slices land.

## Call topology (Decision 16a)

Server Components call application use cases directly. Server Actions are the mutation
mechanism (thin, validated, authorized). Route Handlers exist only for interactive client
reads (viewport, selected-café enrichment, card-photo batch) and future external
protocols. No server code makes HTTP requests to this app's own Route Handlers.

## Enforcement wiring (in place)

- ESLint flat config (`eslint.config.mjs`): Next core-web-vitals + TypeScript + the
  import boundaries above.
- `tools/governance-check.sh`: no foreign lockfiles, no `src/`, archived docs marked,
  governance docs present, allowlist JSON valid, AGENTS.md link integrity.
- `tools/check-dependencies.mjs`: every `package.json` dependency is allowlisted with an
  installable status.
- `npm run verify` runs all of the above plus typecheck and Tier 1 tests; the Vercel build
  runs `verify` then `next build`.

## Exemplars (added with their real slices — never as placeholders)

Landed (Step 3B — database baseline): single-source domain vocabularies + Zod
(`lib/domain/attributes.ts`, `hours.ts`); Drizzle schema with DB-enforced CHECK
matrix (`lib/db/schema/*.ts`); custom-SQL migration for objects Drizzle can't
model (`drizzle/0000_baseline.sql` — PostGIS generated geography, GiST indexes,
append-only triggers, cross-table constraint trigger); application use case over
an injected repository port with the pure decision core in domain
(`lib/application/attributes/promote-attribute-observation.ts`,
`lib/domain/attribute-promotion.ts`, `lib/db/repositories/attribute-promotion-repo.ts`);
Tier 2 database harness (`tests/integration/`).

Landed (Step 4 — public read slice): validated server env (`lib/env/server.ts`);
one pooled runtime DB client (`lib/db/connection.ts`); typed public read query
(`lib/db/queries/published-cafes.ts`); reviewed parameterized spatial query
(`lib/db/spatial/cafes.ts`); Server Component → application use case → narrow view
DTO (`app/(public)/page.tsx`, `app/(public)/cafes/[slug]/page.tsx`,
`lib/application/places/*`, `lib/domain/place-view.ts`); presentational components
taking DTOs (`components/list`, `components/place`); local-only dev fixtures
(`tools/seed-dev.mjs`).

Landed (Step 4 — operator surface): Better Auth route handler + browser-safe
client (`app/api/auth/[...all]/route.ts`, `lib/auth/client.ts`); operator
authorization gate — valid session AND active `operators` row, no client-trusted
authorization (`lib/application/operators/current-operator.ts`,
`lib/db/queries/operators.ts`); Server Action mutation exemplar — thin, authorized,
validated (`app/(operator)/admin/actions.ts`); operator form via `useActionState`
(`app/(operator)/admin/new/`); operator-write use cases over transactional writes
that pair each record change with its append-only curation event
(`lib/application/places/create-cafe.ts`, `set-cafe-publication.ts`,
`lib/db/queries/cafe-mutations.ts`, `lib/domain/cafe-input.ts`).

Landed (Step 4 — operator curation): attribute-observation + hours curation
forms (`app/(operator)/admin/cafes/[id]/`); evidence recording that appends the
immutable curator observation + accepted decision and promotes it through the
promotion use case — the sole pointer writer — in one transaction
(`lib/application/attributes/record-attribute-observation.ts`,
`lib/db/queries/attribute-mutations.ts`, `lib/domain/attribute-observation-input.ts`);
structured-hours upsert paired with its `hours_updated` curation event
(`lib/application/hours/set-cafe-hours.ts`, `lib/db/queries/hours-mutations.ts`,
`lib/domain/hours-input.ts`); operator-action authorization boundary test
(`tests/boundaries/operator-action-auth.test.ts`).

Landed (Step 4 — slice 2 pt.1, ingestion): operator-run ingestion adapter over a
validated external extract — pure provider parsing
(`lib/integrations/overture/extract.ts`), normalized index contract
(`lib/domain/overture-index.ts`), idempotent batch upsert
(`lib/db/queries/overture-mutations.ts`, `lib/ingestion/overture-index.ts`),
PostGIS-validated boundary import (`lib/ingestion/service-area.ts`), thin
`tsx` CLIs with job locks and dry-run (`tools/ingest-overture.mts`,
`tools/import-service-area.mts`, `tools/script-db.ts`); runbook
`docs/operations/ingestion.md`; forward migration exemplar
(`drizzle/0001_overture_index.sql` — generated DDL + custom PostGIS section).

Pending (later Step 4 slices): GP-1 candidate queue + decisions · Google server
call (Text Search IDs-only) · route handler (interactive client reads) · client
island fetch · Maps browser adapter · semantic-search intersection · contextual
Place-ID verification · flagged use case.
