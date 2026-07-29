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

Pending (later Step 4 slices): route handler (interactive client reads) · client
island fetch · Google server call · Maps browser adapter · semantic-search
intersection · contextual Place-ID verification · ingestion adapter · flagged use
case · attribute-observation + hours curation forms.
