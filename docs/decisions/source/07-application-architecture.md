# Operative decision records — Decisions 13, 15, 16, 17, 18: application architecture

## Decision 13 — Structure and module boundaries (approved 2026-07-24)

Structure (root-level; **no `src/`**): `app/(public)`,
`app/(operator)/{admin,gp1}`, `app/api`;
`components/{ui,map,list,place,search,admin,gp1}`;
`lib/{domain,application,db,auth,integrations/google/{client,server},integrations/overture,ingestion,flags}`
(plus `lib/contracts/http`, `lib/env`, `lib/client-state` from Decisions
15/17/18); `scripts`, `docs`, `drizzle`, `tests`.

- `lib/domain/`: pure TypeScript only — canonical types, study-attribute
  rules, publication eligibility, confidence/provenance/freshness rules,
  pure validation/transformation. No Next.js, Drizzle, Better Auth, Google
  SDKs, environment, or IO imports.
- `lib/application/`: use cases (list published cafés; load café details;
  local name search; semantic curated search; contextual enrichment;
  publish/unpublish; GP-1 candidate review; privileged operator actions).
  Routes/components never self-coordinate DB+auth+Google when a use case
  exists. Use cases return narrow application DTOs — never raw Drizzle
  rows or raw provider responses.
- `lib/integrations/google/client/`: browser-safe only — Maps JS loader
  configuration, map IDs/public config, map adapters, marker/cluster/
  bounds/viewport utilities, client-safe types. Never server credentials,
  Places callers, contextual modules, or database code.
- `lib/integrations/google/server/`: server-only (build-enforced) — Place
  Details caller, IDs-only Text Search caller, contextual caller, approved
  query-template construction, exact field masks, runtime response
  validation, exact Place-ID matching, quota/per-SKU accounting hooks,
  provider→display-DTO mapping, attribution/disclosure composition. No
  unrestricted raw Google response reaches a component, route response, or
  persistence function.
- Contextual isolation: own use case, own server module, own Route Handler
  where required, own flag and quota; no dependency from ordinary browsing
  or IDs-only matching into the contextual module; removable without a
  database migration.
- `lib/flags/`: typed registry; server-side evaluation; separate
  definitions (semantic search, contextual enrichment, list-card photos);
  explicit client exposure only where rendering requires; no scattered
  string flags.

Dependency graph (lint-enforced): domain → nothing; db, auth/server,
google/server, overture, ingestion → domain; application → domain + narrow
infrastructure interfaces/modules; google/client → browser-safe shared
types only; components → domain types + application DTOs + google/client
where map functionality requires; app → application + components +
approved auth entry points; scripts → application or ingestion.
Prohibitions: no component imports from db/ or google/server/; no client
module imports a server-only module; no domain import from application,
provider, persistence, auth, or UI layers; no route directly coordinates
provider and database operations when a use case exists; no imports from
docs/archive; no GP-1 import from google/client, map components, or the
Maps JavaScript loader; no raw Google response type crosses into
persistence code; **of Google-returned data, no field other than an
approved Place ID can reach canonical database writes**; no scripts
duplicate domain or application business rules.

Google call mediation: server-side. Client-triggered operations go through
thin Route Handlers (input parsing/validation → anonymous or operator
rate-limit checks → session and quota checks → one application use case →
HTTP response mapping; never an orchestration layer). Server Components
and server-side code call use cases directly; never HTTP requests to this
application's own Route Handlers. Credentials: separate browser key
(referrer-restricted, approved browser APIs only, no server Places
permission) and server credential (never in browser bundles; restricted to
required Places APIs; OAuth/ADC where straightforward, else a dedicated
server-secret key; IP restrictions only with stable outbound addresses;
independent quotas, alerts, request accounting); the Google server adapter
hides the credential mechanism.

Operator surfaces: `(operator)` layout provides shared operator
authentication and navigation without altering public URLs; explicit
server-side authorization inside every privileged use case;
redirect-based authentication never treated as authorization; GP-1
mapless by construction with both an import-boundary rule and a focused
CI assertion; admin's approved Google display permission never leaks into
GP-1; separate deployments remain a documented future option.

Enforcement (Step 2B): ESLint import-boundary rules matching the graph
(primary mechanism — no second home-grown allowlist system; a graph tool
only for circular-dependency detection); build-enforced
server-only/client-only boundaries; TypeScript aliases aligned to layers;
circular-dependency detection; GP-1 mapless static-import test;
persistence-boundary tests rejecting all non-ID Google fields; tests that
contextual responses cannot reach database write paths; intersection-
before-display tests; unmatched-results-never-exposed tests; exact-ID-
equality tests; attribution-survives-DTO-mapping tests; no-persistence
tests for semantic ranking and contextual content; flag-off-bypasses-
provider tests; environment validation separating public and server-only
variables; dependency-governance checks (unapproved packages, foreign
lockfiles); named canonical exemplars (13: server component→use case;
client component→thin Route Handler; route handler; domain rule; Drizzle
query; spatial query; Google server call; Google browser-map adapter;
semantic-search intersection; contextual Place-ID verification; ingestion
adapter; feature-flagged use case; operator authorization check).
Compliance-bearing, non-optional list recorded for AGENTS.md and test
docs: IDs-only matching; intersection with published records; non-display
of unmatched results; session-only relevance order; exact ID matching for
contextual; attribution/disclosure; no Google persistence beyond approved
Place IDs; correct flag-off behavior.

## Decision 15 — Client state (approved 2026-07-24)

URL-first committed public state: the URL is sole source of truth for the
submitted semantic query, committed filters, and selected café — via one
typed codec `lib/client-state/public-map-url.ts` owning parameter names,
parsing/validation, defaults, canonical serialization, stable ordering,
default omission, length limits, and unsupported-value rejection; no
scattered `URLSearchParams` parsing. Draft vs committed: typing stays
local; the URL changes on explicit submission/apply/selection. Router
usage: RSCs read committed values from page inputs; client components use
approved navigation APIs; fresh-server-data changes navigate; purely
presentational updates may use native History API; push vs replace is
intentional. Never in the URL: Google relevance ordering, contextual
content, live camera state, drawer animation state. An intercepted/
parallel route for the café panel is an implementation-time option.

Ephemeral state: React built-ins only — one bounded MapExplorer feature
(Search, CaféList, GoogleMap, CaféPanel); escalation ladder: local
useState → lifted state → useReducer for related transitions → narrowly
scoped context under real prop-drilling pressure → Base UI-owned state.
Candidate values: hovered/focused café ID, draft search input, in-memory
semantic ordering, panel state Base UI doesn't own, settled bounds,
request-generation identifier. No server-fetched cache state in
reducers/context (Decision 16 owns it); no per-frame camera state.

Maps imperative boundary: refs are not general state containers; a
contained ref lives only inside the Google Maps client adapter (container
element, map instance, provider handles, non-rendering mutables). No map
handle is exposed; features interact declaratively (props/events, e.g.
`GoogleMapCanvas` with cafes/selectedCafeId/targetViewport/onCafeSelect/
onIdle); the map owns live camera state during movement and publishes
settled events (`idle`). `useSyncExternalStore` is evaluated before any
state library if formal external subscription becomes necessary.

Selection History binding (16-x-ii): the selected café is URL-owned;
router navigation by default when server-rendered data or route state
changes; native History API only for verified client-only presentation
updates; user selection normally creates a back entry; corrective
normalization uses replace; back/forward synchronize list, marker, and
panel; no second selected-café source of truth; no raw `pushState` to
bypass approved router behavior.

Session semantic state (compliance-bearing): durable representation is
allowed for the submitted query text (URL), WorkinCafe slugs/IDs, and
filters. Session-memory-only: Google's relevance order, ordered semantic
results, contextual responses, raw metadata not approved for storage —
never written to URL parameters, cookies, localStorage, sessionStorage,
IndexedDB, the database, durable caches, analytics payloads, logs, or
error breadcrumbs containing content or ordered IDs. Transient
request/response DTO transport and process/browser memory for the active
session are permitted ("never serialized" = never durably persisted). A
shared URL or reload executes a fresh search and never reconstructs an old
order. Required tests: no ordering URL parameter; no browser-storage
writes of ordering; ordered Place IDs absent from writes/logs/analytics/
error reporting; reload performs a fresh search; flag-off makes no
provider request; raw Google responses never in general React state;
contextual content non-persistent.

Toasts/status: Base UI toast/announcement pattern; no toast package; no
queues in a general store; critical errors inline at the surface; loading
on the initiating control; toasts for transient non-critical feedback;
AT-accessible announcements; no raw Google content in toasts; cleared on
reload. Dependencies: no Zustand, no nuqs at launch; Zustand deferred
behind five evidence conditions (distant rapid-state coordination;
measured render problems; context complexity exceeding a bounded store;
multiple independent islands with selective subscriptions; a bounded store
simplifying ownership without absorbing URL/server/provider state).

## Decision 16 — Server-state fetching and caching (approved 2026-07-24)

Topology: Server Components call use cases directly (initial map/list,
detail pages, submitted semantic results, operator and GP-1 reads) and
never call this app's Route Handlers, use Server Actions for reads, or
bypass existing use cases. Server Actions are the primary mutation
mechanism (operator café create/edit, publish/unpublish, curation and
provenance changes, GP-1 review decisions, enrollment/account actions,
authorization-sensitive mutations, semantic-search submission that
validates and commits the canonical URL). Every Server Action
independently performs runtime input validation, authentication where
required, server-side authorization, feature-flag checks, abuse/rate
controls where appropriate, one use-case invocation, and serialization of
only an approved result; hidden fields, bound IDs, submitted roles, and
client-provided operator state are never authorization evidence; actions
are thin colocated adapters without business rules, direct Drizzle
queries, or raw Google orchestration; no global actions dumping ground.
Route Handlers exist only for browser-driven reads needing independent
loading, concurrency, AbortController, stale rejection, explicit cache
headers, per-request accounting, or a conventional endpoint: map viewport
reads after `idle`; one narrow selected-café enrichment operation (safe
server-side parallelism); a bounded visible-card photo batch; future
external protocols. Handlers stay thin (parse/validate → feature/rate/
quota/session controls → one use case → approved DTO + headers).

Client-island fetching: one small built-in pattern — standard fetch, typed
DTOs, runtime response validation, AbortController, request-generation
stale rejection, in-flight-only dedupe, explicit loading/empty/success/
failure states, no automatic retry for billable Google operations, no
durable completed-response cache; one shared transport helper plus
feature-owned request functions; no TanStack Query at launch
(evidence-gated); client cancellation never suppresses accounting for a
started provider request.

Canonical caching: uncached request-time reads at launch under the latest
stable explicit opt-in model — no `use cache` on canonical reads, no
`unstable_cache`, no speculative ISR, no time-based public caching;
static shells may prerender; Suspense streaming allowed. Designed upgrade:
evidence-justified explicit cache boundaries with explicit lifetimes and
application-owned tags invalidated by publish/edit/unpublish use cases;
Google integration code stays outside every cached scope; no split
Data-Cache/CDN strategy without a decision on invalidation interaction.

Google cache boundary (compliance-bearing): every server-side Places
request uses `cache: "no-store"`; Google provider modules never execute
inside or use `use cache` (any variant), `unstable_cache`, durable
memoization, custom cache handlers, shared completed-response caching, or
browser persistence; development-time fetch reuse is verified and
neutralized. Browser-facing Google-content responses send
`Cache-Control: private, no-store, max-age=0` and never s-maxage/SWR/
tags/surrogate directives; POST for semantic and contextual operations.
DTO boundary: no component receives an unrestricted raw Google response;
mappers cannot return review/photo content stripped of required Google
attribution, reviewer attribution, disclosure text, source links, or
flag links. Photos: never proxied into a WorkinCafe cache; never sent
through the Next.js image optimizer; current live photo URI rendered
directly (unoptimized) with attribution; photo names, references,
resolved URIs, image bytes, and curator selections are never persisted.
Accounting: one event per actual outbound attempt (feature, SKU/field-mask
class, timestamp, latency, outcome category, count, flag state); never log
review text, contextual passages, photo URIs, raw payloads, or ordered
Place IDs; no automatic billable retry — any future policy explicit,
bounded, accounted.

Active-display lifetime: no general session cache; permitted only —
holding the Google display DTO while that exact café panel is open;
reuse across rerenders of the open panel; sharing identical in-flight
requests; removing in-flight entries after success or failure. Discard on
selection change, panel close, unmount, reload; reopening re-fetches
unless the confirmed GP-2 correspondence explicitly authorizes broader
reuse. 26 test obligations recorded in the obligations matrix.

## Decision 17 — Validation and forms (approved 2026-07-24)

Zod v4 is the single default runtime-validation library at: Server Action
boundaries, Route Handler request boundaries, provider-response
boundaries, ingestion/operator-script boundaries, environment boundaries,
and form-action state construction. Every public server entry point
validates independently; no raw ZodError crosses server/client; failures
become narrow serializable errors; provider schemas are server-only; no
large server schemas in client bundles; `zod/mini` only on future reviewed
substantial client-side need. Hand-written validation only for tiny
internal assertions.

Schema ownership: "Structural schemas derive where an authoritative
structural source exists; use-case schemas explicitly compose, narrow and
refine those structures." Closed vocabularies are defined once as pure
domain constants and consumed by Drizzle, Zod, and UI — never reproduced;
an exemplar proves one vocabulary drives all representations. Canonical
write flow: Drizzle-derived structural schema → omit server-owned and
forbidden columns (IDs, timestamps, audit/publication metadata, derived
spatial values, operator identity, provenance fields not legitimately
form-supplied) → use-case constraints → cross-field/domain refinements →
application command; generated schemas are never public contracts;
update schemas never silently expose every column; database constraints
remain authoritative. Business invariants (cross-field requirements,
publication eligibility, conditional requireds, state transitions,
provenance/confidence rules, operator restrictions) live in
domain/application rules, not forced into Drizzle. Provider responses:
hand-authored schemas under `lib/integrations/google/server/` validating
only the approved field mask; flow: unknown payload → validated provider
response → compliance checks (exact Place-ID match) → narrow attributed
display DTO; never provider payload → canonical write type. FormData:
per-form deliberate normalization in the thin adapter (repeated fields,
absent checkboxes, files) before Zod; business validation in
use-case/domain schemas. Transport: shared issue concepts (field path,
machine-readable code, human-safe message); Actions and Handlers need not
share one envelope — Decision 17 owns form-action state; Decision 18 owns
HTTP envelopes.

Forms: native HTML forms + Server Actions; no client form library at
launch. Lightest suitable pattern per form: plain actions for
redirect-only/simple commands (semantic search, publish/unpublish, GP-1
accept/reject); `useActionState` only for field errors, form-level
failures, preserved values, or non-redirecting state, with descendant
`useFormStatus` for pending. Canonical typed action-state
(status/fieldErrors/formErrors/values); serializable only; no raw
exceptions, raw Google content, authorization details, secrets, or
sensitive inputs returned. Progressive enhancement wherever the
interaction reasonably permits; the semantic-search form remains native →
thin validation action → canonical URL redirect → RSC search. No
optimistic updates by default; `useOptimistic` only for specific approved
mutations with unambiguous results, designed rollback, authoritative
server validation, and no misleading compliance/publication states.
Conform is the first evaluation candidate on recorded triggers (complex
repeated collections, nested editing, dynamic hours editors, substantial
client constraint feedback, repeated coordination boilerplate, a11y
pressure) — evaluation, not pre-approval.

Errors/accessibility: one documented action-state convention; field errors
beside fields with `aria-describedby` + `aria-invalid` + stable IDs;
form-level error summary linking to fields where practical; pending
controls expose disabled/busy without losing accessible names; critical
failures inline; success redirects or renders status; messages never leak
internals/SQL/provider payloads/secrets/authorization logic; robust focus
strategy demonstrated in the canonical operator-form exemplar
(Drizzle-derived validation → use-case narrowing → authorization →
useActionState → useFormStatus → errors → PE → completion; no direct
Drizzle in the action).

Environment: in-repository Zod layer, split `lib/env/server.ts`
(`server-only`; explicit named variables; typed exports; feature-
conditional credential validation so optional-provider secrets are not
demanded by unrelated commands/tests/migrations; early clear failure via a
reviewed initialization/import boundary appropriate to serverless) and
`lib/env/public.ts` (browser-safe only; explicit static `NEXT_PUBLIC_*`
references honoring build-time inlining; validated; no dynamic indexing).
`.env.example` committed with names and safe descriptions only; never real
credentials; tests supply explicit values; scripts fail clearly; client
code imports only the public module; provider modules import only their
required server values; validation errors never print secrets.
`@t3-oss/env-nextjs` governance-gated. Dependencies: `zod` plus one stable
Drizzle-to-Zod integration selected at implementation (see the approved
capability entry in `docs/approved-dependencies.json`).

## Decision 18 — API contracts (approved 2026-07-24)

Success: bare JSON DTOs; no ok/data wrapper; 200 reads, 201 only for
future resource creation, 204 only for intentionally body-less success.
Better Auth's mounted handler is library-owned and exempt from custom
envelope rules. Error contract: one shape — `{ error: { code, message,
fieldErrors?, requestId? } }`; code stable and machine-readable; message
human-safe and never parsed for control flow; fieldErrors only for
validation with meaningful paths; never stack traces, raw exceptions, SQL
details, provider payloads, secrets, authorization reasoning, review
text, contextual passages, photo URIs, or ordered Place IDs. No RFC 9457
registry at launch. Status mapping: 400 all ordinary validation (no
400/422 split); 401 missing/invalid session on operator endpoints; 403
authenticated but unauthorized (no policy detail); 404 unknown resources,
unknown endpoints, and deliberately flag-disabled features (never for
quotas, outages, or breakers); 409 state conflicts (stale edits, invalid
transitions, duplicate-conflicts); 413 over explicit size limits; 415
unsupported media type on JSON-only endpoints; 429 caller-specific rate
enforcement with Retry-After only when meaningful, never cached; 502
upstream failure with normalized categories (UPSTREAM_REJECTED /
UPSTREAM_INVALID_RESPONSE / UPSTREAM_FAILURE), never raw Google bodies;
503 temporary WorkinCafe-level unavailability (shared quota exhaustion,
cost circuit breaker, operationally disabled provider traffic, overload);
504 upstream timeout; 500 generic unexpected only. Stability: private
same-deployment contract — no /v1, no compatibility window, breaking
changes within one coordinated deployment, reviewed and tested; no
external consumer on internal routes; any public API/native client/
partner/webhook surface requires a new decision and a separately
versioned surface. Placement: browser-safe wire contracts in
`lib/contracts/http/` (request/response schemas, inferred types, stable
error codes, transport primitives) importing no server-only modules,
Drizzle, auth server config, Google server integrations, secrets, or use-
case implementations; handlers, adapters, and client callers consume the
same contracts; use cases remain HTTP-independent (request contract →
command/query → DTO → response contract). Client response validation via
narrow imported schemas (Zod v4 tree-shaking verified at implementation;
zod/mini only on bundle evidence). Geographic transport: one pure
canonical `GeoBounds` (south/west/north/east) with domain-owned invariants
(ranges, south≤north, longitude boundary handling, Toronto restrictions
where required); HTTP parses query strings into it; the URL codec shares
conventions without importing route schemas. JSON POST handlers: approved
content type; small explicit per-endpoint size limits; pre-work rejection;
parse once; colocated Zod contract; strict where appropriate. Viewport GET
handlers validate all parameters. Standard Response/NextResponse.json;
Decision 16 cache split preserved. Request correlation: one identifier per
WorkinCafe-owned handler — trusted platform request ID when available and
well-formed, else a boundary-generated UUID; caller-supplied headers
validated and length-limited, never blindly trusted; returned as
`X-Request-Id`; included in the envelope optionally; passed into
operational logging and Google accounting; never a cache key, credential,
user identifier, or behavior source; no prohibited content attached. 26
test obligations recorded; shared contracts are the type-level drift
mechanism; no OpenAPI, code generation, or route versioning for this
private surface at launch.
