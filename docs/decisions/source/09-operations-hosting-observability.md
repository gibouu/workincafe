# Operative decision records — Decisions 19–21: jobs, hosting, observability

## Decision 19 — Background jobs and ingestion execution (approved 2026-07-24)

**No background infrastructure at launch.** Non-adoptions (intentional):
custom GitHub Actions workflows of any kind; external database-backup
infrastructure; Vercel Cron; queue/worker infrastructure; Inngest;
Trigger.dev; general workflow orchestration; background processing inside
Vercel request handlers; scheduled Overture refreshes; scheduled DineSafe
refreshes; scheduled GP-1 seeding; automated publishing or closure
decisions; materialized-view refresh jobs; cache-refresh jobs; retry
infrastructure for background operations. Re-proposal triggers: important
unattended work repeatedly missed; manual execution causing meaningful
data-quality incidents; a task that cannot reasonably run from an operator
machine; runtime/resource needs exceeding the operator workflow;
resumability/controlled-retry requirements; coordinated concurrency across
jobs; a user-facing asynchronous workload; backups justified under the
19a triggers.

**19a — Backups: none at launch (explicit accepted risk).** No scheduled
backup workflow, storage provider, encryption keys, automated `pg_dump`,
retention automation, restore-testing infrastructure, or backup
monitoring. Neon provider recovery is used as available but is not an
independent off-provider backup system. The application must never be
described as having provider-independent disaster recovery.
Reconsideration triggers: real users contributing irreplaceable
information; material non-reconstructable data; substantial curation
volume; commercialization/operational importance; decreased loss/downtime
tolerance; a data-loss incident or near miss; a destructive migration or
bulk ingestion raising risk; Neon's recovery window no longer matching
needs; provider independence becoming a requirement. At a trigger, a new
decision compares dump mechanism, storage provider, schedule, retention,
restore testing, monitoring, and credential/encryption-key ownership. No
partial mechanism installed to appear prepared. (Supersedes 5-BK.)

**19b — Overture/DineSafe refreshes:** operator-run repository CLIs on a
documented ~monthly cadence (runbook + personal calendar reminder +
explicit execution + concise summary). Scripts: Node 24.x; approved env
modules; clear missing-config failures; direct operational connection
where appropriate; validate all external input; job locks where duplicate
concurrent execution is unsafe; idempotent/safely repeatable where
practical; dry-run where meaningful; produce review tasks — never
automatically publish, merge, close, or delete a café; record meaningful
outcomes in the approved event history; never log raw provider payloads or
restricted Google content; exit non-zero on failure. A dispatched or
scheduled workflow may be proposed only on material inconvenience or
actual missed-run data-quality problems.

**19c — GP-1:** operator-initiated only (see source/05; compliance rule).

**19e — Shared operator-script bindings:** repository-owned; Node 24.x;
approved env layer; clear failures; direct connections where appropriate;
never inside Vercel request functions; explicit timeouts; locks where
concurrency harms; no unbounded/automatic retries; all Google content,
attribution, logging, and persistence restrictions respected; durable
outcomes recorded in approved event history (terminal output is never the
sole record); documented npm commands; help text; dry-run where
meaningful; explicit production confirmation for potentially destructive
operations; non-zero exit on failure; concise safe summaries; scripts call
approved ingestion/application modules and never duplicate business
rules.

**GitHub's role:** repository hosting; branches/PRs; review; branch
protection; Vercel deployment status; built-in security features;
approved automated dependency-update PRs where no custom workflow is
required. Do not add, expand, or rely on custom GitHub Actions workflows
during reconstruction; existing legacy workflow files remain historical
infrastructure pending their approved removal in Step 3A and are not the
target pipeline; the final launch state contains no custom GitHub Actions
workflows. Any future workflow requires its own decision plus evidence
that the standard Vercel or operator-run path cannot adequately handle
the operation.

## Decision 20 — Hosting and deployment (approved 2026-07-24)

**Vercel Hobby** for the current personal, non-commercial phase. Hobby is
approved only while: the project remains personal and non-commercial; no
one is paid specifically to build or operate the deployment; no financial
gain, advertising, paid partnership, subscription, paid listing, affiliate
revenue, or commercial pilot; the repository remains public while multiple
contributors rely on automatic previews. Upgrade before the first
deployment affected by: a paid developer/contractor; monetization or
commercial partnership; use within a revenue-generating business; going
private while contributors need previews; needing shared Vercel ownership;
insufficient Hobby limits. If either developer is already paid
specifically for WorkinCafe, begin on Pro. Single-owner Hobby project is
an accepted temporary risk with mitigations: GitHub is canonical source;
Neon, Google Cloud, and the domain live outside Vercel; safe deployment
configuration committed; env-variable names and restoration instructions
documented privately; no irreplaceable data or compliance evidence only in
Vercel; redeployable elsewhere from the repository. Recorded: Vercel Pro
for two active deploying developers ≈ USD $40/month before usage.
Cloudflare/OpenNext and container hosts remain documented fallbacks.

**Pipeline:** Vercel's Git integration is the complete launch pipeline —
PR → automatic Preview; merge to `main` → automatic Production. No custom
GitHub Actions for CI, deployment, previews, production, migrations, or
separate lint/type/test jobs; the Vercel deployment status is the required
branch-protection check; no second CI system. One canonical build command:
`npm run verify` (format:check → lint → typecheck → migration static
checks → Tier 1 tests) → `next build` → environment-aware committed
migrations → release. Verification includes the approved checks (linting,
type checking, unit/integration tests, import-boundary checks,
compliance-bearing Google persistence tests, GP-1 mapless checks,
migration consistency, applied-migration immutability, production build).
Migration execution: only after verification and build succeed;
PostgreSQL advisory lock (bounded wait/clear failure policy; released on
success and failure; applied migrations are no-ops; the Drizzle journal is
the ordering source); direct connection, never the pooled runtime
connection; a failed migration fails the deployment; migrations never run
at startup or request time; a migration may succeed while a later release
step fails, so the previous production deployment must remain compatible
with every newly applied migration (forward-only; additive ordinary
changes; expand/contract for destructive ones; immutable applied
migrations; no `drizzle-kit push`). Staged build/migrate/smoke/promote
remains a future option on operational evidence.

**Previews:** every PR gets a standard Vercel Preview; previews never use
production database credentials; each database-backed preview uses an
isolated Neon preview branch/disposable database with preview pooled and
direct URLs, safe seed data, and no production Better Auth sessions or
operator data; the preview build runs the same verify+build sequence and
migrates only its own database; prefer the standard Neon–Vercel
integration over custom implementations; without an isolated preview
database, never connect to production — disable DB-backed preview
functionality or fail clearly.

**Environments and credentials:** three classes (Production, Preview,
Local); full database separation with clear missing-config failures.
Google browser keys: production key restricted to the production domain
and required browser APIs only; a separate dev/preview key with its own
low quota, approved APIs, the narrowest supported preview-domain
restriction, and localhost only where needed; never a broadly unrestricted
`*.vercel.app` key — if safe preview restrictions are impossible, disable
Google Maps in generic previews. Server credential: production-only by
default; previews run semantic matching, contextual enrichment, list-card
photos, and other billable server operations disabled; a trusted preview
may enable them only with a separate non-production credential, strict
restrictions, low quotas, an isolated database, explicit opt-in flags, and
the same no-cache/no-persistence rules; flag-off paths function with
credentials absent.

**Runtime/region:** Node 24.x (package.json, Vercel settings, local,
scripts — the repository pin is the source of truth and Vercel must match
it); Vercel Node.js runtime; region `iad1`; Neon `us-east-1`. No Edge
runtime for Drizzle/Neon access, Better Auth, Google server integrations,
or migrations — future Edge use is a separate decision. No approved
handler depends on maximum function duration; short explicit provider and
database timeouts; long-running work never inside Vercel functions.

**Domain (Target requirement / verification pending):** verify the
workin.cafe registrar, registrant and account owner, recovery methods,
renewal status and payment method, nameservers, DNS records, responsible-
owner access, and the repointing process if Vercel becomes unavailable;
document privately; never transfer registration to Vercel; keep registrar
ownership independent of the hosting provider. This record states the
requirement and makes no claim that verification has occurred.

**Target requirement (accounts):** GitHub ownership/collaborator
permissions, Vercel project ownership, Neon organization access, and
Google Cloud project access are verified during Step 0/1 and the
applicable setup steps; no repository document claims verified state
before then. 25 acceptance checks recorded in the obligations/acceptance
documentation.

## Decision 21 — Observability and analytics (approved 2026-07-24)

**Ruling:** "External observability, error monitoring, product analytics,
uptime monitoring and real-user performance telemetry are deferred at
launch. The application uses only Vercel's transient server logs, existing
durable domain/operational records, and provider-native deployment,
billing and quota notifications."

Non-adoptions: @sentry/nextjs, PostHog (incl. error tracking), GlitchTip,
hosted error monitoring, source-map uploads, release tracking, tunnels,
vendor Server-Action instrumentation; Pino, Winston, OpenTelemetry, log
drains, logging services, a broad observability architecture, client log
shipping; all product analytics (PostHog, Umami, Vercel Web Analytics,
first-party analytics-events table, client SDKs, tracking cookies,
anonymous visitor identifiers, session identifiers, fingerprints,
server-hash identification, funnels, custom event endpoints); uptime
pingers, synthetic checks, health probes, status pages, availability
reporting, health endpoints built for nonexistent monitors; Speed
Insights, RUM, web-vitals reporting. Accepted limitations recorded
(short-lived logs; possibly undiagnosable intermittents; no error inbox/
grouping/history/alerting; unmeasured uniques/sessions/volumes/funnels/
retention/acquisition — launch validates informally).

Logging: standard server-side console only; concise safe metadata (level,
event, requestId, feature, category, durationMs, environment); an optional
tiny dependency-free server-only helper only if it prevents repeated
unsafe logging. Never logged: semantic query text; review text; contextual
passages/highlighted text; raw Google payloads; photo URIs; ordered Place
IDs; auth tokens/cookies; connection strings; secrets; raw form
submissions; SQL with values; personal information; entire arbitrary
objects; authorization reasoning. Errors normalized before logging; no raw
exception objects where prohibited content may lurk. Durable records
remain the approved domain events only (Google accounting, curation
history, publication/operator actions, script outcomes) — application
data, minimum structured metadata, no generic database log table.

Alerts: provider-native only — Vercel deployment-failure notifications;
Google Cloud billing-budget notifications; Google API quota limits/alerts
(mandatory — financial-exposure prevention); Neon account/usage
notifications — delivered to a monitored mailbox. No custom webhooks,
paging services, Slack incident integrations, email-alert services,
scheduled health checks, aggregation, or incident automation.

Reconsideration triggers: error monitoring — external reliance, public
launch, undiagnosable errors, recurring failures, retention-blocked
debugging, commercialization, notification needs, value exceeding
cost/privacy surface (re-compare Sentry and PostHog on then-current facts;
no preselected winner). Analytics — real usage, semantic-adoption
decisions, decision-relevant uniques/sessions, campaign measurement,
insufficient direct feedback, monetization reporting (define the questions
first; then compare first-party counts, cookieless PostHog, and other
privacy-focused providers). Uptime — first meaningful public launch, first
external users, first commercial dependency, unnoticed-downtime harm.
Performance telemetry — after users or observed problems make field data
useful. 17 implementation requirements recorded, including documentation
accuracy: retained production error history and product analytics do not
exist at launch.
