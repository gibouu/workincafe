# Deferred-technology register

> Before proposing a dependency, hosted service, workflow system,
> framework, runtime, database, authentication provider, map provider,
> analytics service or testing tool, check this register. If the item is
> listed, cite the relevant source decision and explain which recorded
> trigger or changed fact justifies reconsideration. Otherwise, do not
> re-propose it.

Index and summary only — **the source decision controls** until amended by
a later recorded decision. A trigger initiates reconsideration; it never
authorizes adoption. Adoption, rejection, or recategorization requires a
new recorded decision. Milestone reviews: first external users,
commercialization, significant team growth, major hosting/architecture
change. No scheduled review ceremony. Adopted items keep a short
historical entry linking the superseding decision. Insufficient reasons to
adopt: newer agent preference; popularity; template presence; stability
alone; theoretically solving an undemonstrated problem. Fallbacks are
candidates for a future decision, not pre-approved implementations.

## A. Deferred with named triggers

| Item | Trigger (abbreviated; source holds full text) | Source |
|---|---|---|
| External DB backups | user data / irreplaceable data / curation volume / commercial / tolerance decrease / incident or near miss / risky migration or ingestion / Neon window mismatch / independence requirement | 19a |
| Error monitoring (Sentry / PostHog / GlitchTip — no preselected winner) | external reliance / launch push / undiagnosable errors / recurring failures / retention-blocked debugging / commercial / notification need / value > cost+privacy | 21a |
| Product analytics (define questions first) | real usage / semantic-adoption decision / decision-relevant uniques or sessions / campaign measurement / feedback insufficiency / monetization reporting | 21c |
| Uptime monitoring (+ health endpoint only with it) | public launch / external users / commercial dependency / unnoticed-downtime harm | 21e |
| RUM / Speed Insights | users or observed problems make field data useful | 21f |
| Automated E2E testing, including Playwright or Cypress | external users / escaped regression / checklist skipping or fatigue / material manual cost / multi-browser defects / commercial | 22c |
| Component-testing stack (RTL + DOM environment) | first concrete behavioral/accessibility need | 22d |
| Automated performance/bundle budgets | post-baseline growth / measurable regression / repeated dependency leakage / user reports / commercial | 22e |
| Automated Tier-2 database testing (incl. ephemeral test branches) | discipline skipped / Preview-or-Production migration failure / DB regression on main / team growth / commercial / high-risk schema cadence | 22b |
| Schedulers, queues, workflows (GitHub Actions, Vercel Cron, Inngest, Trigger.dev) | missed unattended work / manual-run data-quality incidents / cannot run from an operator machine / resource limits / resumability or controlled retries / coordinated concurrency / async user workload / backups justified | 19d |
| Google Autocomplete / one-shot Geocoding | production evidence users need exact location navigation | 12 |
| Neon Managed Better Auth | GA + stable non-beta SDK + supported restricted registration + documented backup/export + documented local-dev/test strategy + credible migration story; then concrete advantage + explicit approval | 8e |
| Zustand | rapid distant-subtree coordination / measured render problems / context complexity exceeding a bounded store / multiple independent islands needing selective subscriptions / bounded store simplification without absorbing URL/server/provider state | 15e |
| TanStack Query | measured duplicate-request waste / complicated shared invalidation / background-refresh needs / retry orchestration / multiple islands sharing server state | 16b |
| Conform (TanStack Form as later alternative) | complex repeated collections / nested editable structures / dynamic hours editors / substantial client constraint feedback / repeated server-client validation boilerplate / a11y pressure — evaluation, not pre-approval | 17c |
| Canonical caching (`use cache`, tags, ISR) | evidence-justified boundaries only; explicit lifetimes; application-owned tags; Google code outside every cached scope | 16c |
| Community registration / contributor identity | separate product + privacy + moderation + abuse + security review | 8c |
| Vercel Pro | Hobby eligibility conditions and upgrade-before triggers (recorded in source/09 and privately) | 20a |
| Staged build→migrate→smoke→promote releases | operational evidence the automatic model is insufficient | 20b |
| vaul | a concrete, tested interaction requirement Base UI Drawer cannot achieve | 14c |
| node:test as primary runner | Node's runner, ESM mocking, and the project's TypeScript/import-resolution path together produce a simpler and equally capable configuration than Vitest | 22a |

## B. Governance-gated options (concrete need + review; no automatic adoption, no dependency addition, no scaffolding)

nuqs (15) · @t3-oss/env-nextjs (17) · a second `zod/mini` import style
(17) · @neondatabase/serverless behind the data-access adapter (6) ·
additional primitive families (Radix, React Aria) for demonstrated missing
capability (14) · dedicated mocking library (22) · logging frameworks /
OpenTelemetry / log drains (21) · custom alert integrations (21) ·
dispatched or scheduled ingestion workflows (19b) · intercepted/parallel
route for the café panel (15) · custom autocomplete-style search UI
replacing the approved primitive-backed interface (14/12) · Foursquare
Open Source Places on a demonstrated missing capability (9g) · separate
deployment units (13d) · Edge runtime, any use (20d) · RFC 9457 and a
versioned external API (18) · eslint-plugin-boundaries (24c-G2) ·
@googlemaps/js-api-loader (24c-G4).

## C. Version-upgrade gates

PostgreSQL 18 (5c: Neon non-preview classification + stable extensions +
tooling support + documented tested upgrade) · Drizzle 1.x and its
matching Zod integration (6d/17f: stable channel + full regeneration/
migrate-from-empty/typecheck/test pass) · Node 26 (2a: LTS + Vercel
default + explicit reconsideration) · new majors of core dependencies and
platforms (FW-1 soak posture). Latest-stable-within-the-approved-major
always applies; routine stable minor/patch upgrades are not gated; GA
alone never compels a major; upgrade review assesses compatibility,
migration impact, provider support, and soak.

## D. Documented fallbacks (inactive; no launch dependencies, credentials, or accounts; a new decision activates)

MapLibre GL + OpenFreeMap, with Places UI Kit where applicable (10) ·
Supabase as database-host fallback (5) · Cloudflare/OpenNext (20) ·
container hosting such as Fly.io or Railway (20) · If the external-backup
trigger fires before automation is chosen, an operator-run encrypted
backup command may be evaluated as a temporary option through the required
new backup decision (19a).

## E. Rejected at launch (changed facts + a new decision required; not a universal judgment)

`src/` directory · pnpm, Yarn, Corepack · SQLite-as-a-service, MySQL,
document databases · Prisma ORM, Prisma Postgres · raw SQL + Kanel ·
Auth.js, Clerk, Lucia · Radix as the default primitive system ·
`tailwindcss-animate` · Jest, Mocha, AVA · React Hook Form at launch ·
Cypress at launch as a separate runner (automated E2E remains deferred
generally) · Vercel Web Analytics for the validation metric · Plausible at
launch · OpenAPI, code generation, and route versioning for the private
API · Testcontainers and ephemeral cloud-database tooling · a generic
database logging table · an OSM canonical place-data layer at launch · a
second coequal form, state, component-primitive, or test framework without
a new decision · bulk automatic canonical import from Overture or another
place source · automatic canonical record merging.

## F. Permanent or change-controlled product and compliance rules (NOT deferrals)

**Human review and canonical decisions:** no automatic publication of
cafés; no automatic closure or deletion based solely on DineSafe, licence,
provider, or ingestion data; no automatic canonical merge; candidate,
enrichment, and closure signals create review work for an authorized
human. Changing these requires a new product, provenance, abuse, and
safety decision — not a technical trigger.

**GP-1 confirmed workflow (change-controlled):** IDs-only Google candidate
seeding; the approved bounded query workflow; **of Google-returned data,
only Place IDs may cross the persistence boundary**; mandatory human
review; no retained non-ID Google candidate content; no scheduled,
automatic, or page-load-triggered execution. Material deviation requires
the required new policy inquiry and recorded approval.

**GP-2 confirmed workflow (change-controlled):** descriptive Text Search
uses Google IDs for matching against published WorkinCafe cafés; unmatched
Google businesses are never displayed; canonical WorkinCafe fields remain
primary card content; Google relevance order remains transient; selected
contextual enrichment requires exact Place-ID verification; Google content
remains live-only and attributed; contextual content, reviews, highlights,
photo identifiers, and ordered IDs are not persisted. Material deviation
requires the required new policy inquiry and recorded approval.

**Google-content boundaries (bind every future adoption):** raw Google
responses do not become canonical writes; Google content does not enter
durable caches, analytics, logs, error breadcrumbs, or general
persistence; required attribution may not be separated from displayed
Google content; billable provider calls remain explicitly controlled,
accounted, and non-retrying by default. Examples: adopting PostHog would
not permit logging semantic queries or Google content; adopting TanStack
Query would not permit durable Google response caching; adopting a
scheduler would not permit scheduled GP-1 seeding; adopting an ingestion
workflow would not permit automatic publication.

**Product semantic invariants** (authoritative statement in
`docs/product-scope.md`): unknown ≠ negative; provenance, confidence and
freshness remain represented; observation history remains append-only;
Toronto-only MVP; publication remains a curated WorkinCafe decision.

## Supersession notes

Decision 20 superseded Decision 7's GitHub-Actions migration execution and
the standalone per-PR CI workflow (both now inside the Vercel build).
Decision 19 superseded 5-BK external backups and eliminated launch GitHub
Actions. Decision 21 deferred all observability and analytics. Decision 22
selected Vitest while explicitly not adopting Vite as an application
framework. Decision 11 dissolved when Google became the basemap (GD-1).
