# Operative decision record — Decision 22: testing and CI

Approved 2026-07-24 (including the Vitest-not-Vite clarification).

## Test framework

**Vitest is the sole launch test runner** — latest stable release
compatible with Node 24.x and the approved stack at implementation.
Justification: compliance-bearing provider boundaries requiring module/
function mocking, fake adapters, async testing, TypeScript execution, and
watch mode. Not used: Jest; Node's built-in runner as a second coequal
framework; Mocha; AVA; multiple runner conventions. Node built-in
assertions may be used; discovery/execution remain Vitest-owned. No
coverage tooling merely for a percentage.

**Vitest ≠ Vite adoption.** WorkinCafe remains: Next.js; the Next.js dev
server; the Next.js production build; Turbopack and compiler behavior
selected by the approved stable Next.js release; Vercel's standard
deployment path. Vitest is a development-time runner for isolated
TypeScript tests only (domain rules, use cases, Zod schemas, codecs, HTTP
contracts, DTO/attribution mappers, provider adapters with explicit
fakes, persistence/compliance guards, flag behavior, error normalization,
plain-Node boundary checks). Vitest never proves Next.js runtime behavior
— `next build` and Preview validate Server/Client Component compilation,
route compilation, server-only/client-only compatibility, configuration,
bundling. Minimal Node-environment `vitest.config.ts` solely as
test-runner configuration; no `@vitejs/plugin-react`, `vite-tsconfig-
paths`, `jsdom`, `happy-dom`, React Testing Library, Vite app config, or
Vite commands pre-emptively; no direct `vite` dependency; simplest
reviewed import-resolution; no duplication of Next.js configuration. Not
tested via Vitest at launch: async Server Components, complete pages, App
Router navigation, SSR behavior, browser journeys, deployment behavior.
Alternative assessments recorded: Jest rejected (larger surface; doesn't
solve async-RSC testing); node:test rejected for now — reconsider when
Node's runner, ESM mocking, and the project's TypeScript/import-resolution
path together produce a simpler and equally capable configuration than
Vitest.

## Tiers

**Tier 1 — runs in `npm run verify` on every Preview and Production
deployment.** Plain Node environment: no PostgreSQL service, no Docker, no
production database access, no live Google access, no billable traffic;
explicit test environment values; mocked provider and persistence
adapters. Contents: pure unit tests (domain rules, closed vocabularies,
URL codecs, geographic/bounds validation, form normalization, Zod schemas
and refinements, DTO mappers, attribution composition, state transitions,
flag decisions, error normalization); contract tests (HTTP request/
response schemas, error envelope, status mappings, form-action state,
environment-module separation, serialization boundaries, provider-to-
display DTO contracts); architecture/boundary tests (client cannot import
server-only; components cannot import Drizzle; use cases HTTP-
independent; GP-1 mapless and never importing the map loader or browser
key; Google server modules outside cached scopes; browser-safe contracts
free of secrets/server implementations; operator actions without direct
database access; no prohibited dependency or lockfile) — via ESLint rules
and small filesystem/module tests, not a custom analysis framework;
compliance-bearing mocked tests (GP-1 persistence accepts Google Place IDs
only; non-ID Google candidate fields rejected; provider payloads cannot
become canonical writes; contextual content requires exact Place-ID match;
Google content attributed and never persisted; photo identifiers/URIs/
bytes never persisted; `cache: "no-store"` on Google calls; `private,
no-store, max-age=0` on Google-content responses; no automatic provider
retries; flag-off paths make no provider request; accounting once per
actual outbound attempt; logs and errors exclude prohibited content;
completed contextual responses discarded per the active-panel lifetime;
semantic order and query content never durably stored; flag-disabled
handlers return the approved error without provider calls) — all Google
clients mocked, tests never contact Google; migration static checks
(`drizzle-kit check`; journal consistency; applied-file immutability;
uncommitted-generation detection; push prohibition; direct-URL/advisory-
lock usage verification) — explicitly not proof that SQL executes.

**Tier 2 — local-only database integration tests** against the pinned
local Docker PostgreSQL 17 + PostGIS environment via one documented
command (`npm run db:test`): start/verify disposable environment → create
clean test database → apply the complete committed chain from empty →
verify extensions and custom objects → run database-backed integration
tests → tear down/reset. Coverage: full migration from empty; PostGIS
availability; spatial columns/indexes; representative bounding-box and
distance queries; custom SQL constraints; triggers/functions where
adopted; database-enforced vocabularies and invariants; Drizzle-to-
database mappings; Better Auth table creation and basic adapter
integration; representative canonical create/edit/publish/unpublish
transactions; append-only observation history; curation-event
persistence; persistence rejection of prohibited Google fields. Tier 2
never: connects to production or shared Preview databases; contacts
Google; uses real provider credentials; depends on production data;
modifies a developer's ordinary local database.

**Schema-changing PRs** (migrations, Drizzle schema, PostGIS structures,
custom SQL, constraints, auth schema): the developer runs `npm run
db:test` locally before requesting final review (PR checklist item).
Recorded limitation: "Tier 2 is convention-enforced rather than
automatically enforced by the launch pipeline." Accepted risk for the
two-developer, no-user stage. Reconsider automated database integration
testing on: repeatedly skipped discipline; a migration failure in Preview
or Production; a database regression reaching main; team growth;
commercialization; frequent/high-risk schema changes. No ephemeral Neon
test branch inside every build merely to remove the accepted risk;
Preview migration success is a smoke check, not a Tier 2 substitute.

## Obligations vs test count

Every numbered requirement across decisions is a **coverage obligation**,
not a mandate for one uniquely named test; one good test may cover several
obligations and several tests may cover one. No ceremonial tests. A
lightweight matrix at `docs/testing/obligations.md` maps compliance-
bearing requirements to enforcing test/static rule, tier, module, and any
accepted gap — scoped to security, compliance, persistence, and
architecture boundaries.

## E2E, component, performance

Automated E2E deferred (including Playwright and Cypress; no browsers in
builds; no E2E hosting; no visual regression; no tests against
Production). Release-significant changes use a proportionate manual
Preview checklist (15 recorded points: map/list load; name search;
filters; semantic redirect; curated-only results; selection synchronizes
list/marker/panel/URL; back/forward restore; enrichment renders with
attribution; flag-disabled and provider-failure fallbacks; operator auth;
café create/edit; publish/unpublish; GP-1 mapless; GP-1 explicit
initiation; drawer/panel keyboard usability) — applicable sections only.
Reconsider on: external users; escaped regression; skipped checklists;
material manual cost; multi-browser defects; commercialization.

Component testing: no stack pre-emptively; add React Testing Library and
one compatible DOM environment on first concrete behavioral/accessibility
need (likely: combobox keyboard behavior, error-summary focus, drawer
interaction, selection synchronization) — reviewed addition, one canonical
pattern, no second framework, no large-tree snapshots; test accessible
behavior and user-observable state.

Performance: no arbitrary automated budgets before the first
representative build; at launch review `next build` output on bundle-
affecting changes; keep Maps/map-heavy code in the bounded client island;
keep server-only schemas/providers out of client bundles; avoid duplicate
Maps loaders; local Lighthouse for actual concerns; no Lighthouse CI,
bundle-analyzer automation, hosted performance testing, synthetic
monitoring, or blocking size packages; document a measured baseline after
the first representative public map build. Reconsider on: significant
growth, measurable regression, repeated leakage, user reports,
commercialization.

## Placement, commands, environment

Tests in root `tests/{unit,contracts,boundaries,compliance,integration}`
(colocation permitted where materially clearer; one primary convention
chosen at implementation; no `src/`). Canonical scripts: `npm test`
(Tier 1), `npm run test:watch`, `npm run verify` (format:check → lint →
typecheck → migration static checks → Tier 1), `npm run db:test`
(Tier 2). `next build` remains a separate stage after verify in the
Vercel command; never run twice through nested scripts. All tests:
explicit test environment values; clear failures on missing config; fake/
disposable credentials only; mocked billable providers; guarded against
accidental Google network access; no production or Preview database URLs;
no prohibited logging; deterministic and order-independent; clean up
state; no sleep-based timing; fake timers only where clarifying; test
behavior, not framework internals. A safety guard fails tests immediately
if a database URL appears to target the production Neon project/branch.

## Dependencies

Adds `vitest` only (dev dependency; never in the production bundle).
Deferred until first reviewed need: @testing-library/react, a DOM
environment, Playwright, coverage packages, Lighthouse tooling, bundle
analyzers, Testcontainers, ephemeral cloud-database tooling; no dedicated
mocking library unless Vitest built-ins prove insufficient.
