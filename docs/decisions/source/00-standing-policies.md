# Operative decision records — standing policies & pre-decisions

Ratified July 2026. Format: ruling · bindings · supersessions · triggers.

## FW-1 — Framework and version policy (standing)

Use the latest stable, security-supported release of each approved
technology at implementation time, verified from official sources then —
never from memory. No canary, beta, preview, RC, or experimental releases
or features without a separate proposal (benefits, risks, exit plan) and
explicit technical-lead approval. Exact installed versions are recorded via
the lockfile and, where decided, the architecture record. Majors change
only through reviewed upgrade PRs verifying: official upgrade guide and
breaking changes, runtime/React compatibility, build, type checking,
tests, bundle/performance regressions, deprecated or newly experimental
APIs. New majors of core dependencies follow a soak posture: prefer the
prior stable line until the new major has meaningful patch-release soak;
GA alone never compels adoption. Latest-stable-within-the-approved-major
always applies; routine stable minor/patch upgrades are not gated.

## PLAT-1 — Platform alignment (standing)

For technologies adjacent to Vercel and Next.js prefer, in order: latest
stable production release; official Next.js compatibility; official Vercel
support; the standard Vercel path with the least custom configuration;
explicit major-version pinning so platform-default changes never silently
alter the stack.

## ENF-1 — Enforcement scope (standing)

The database enforces relational invariants: primary/foreign keys,
uniqueness, non-null, closed-value constraints where appropriate,
referential integrity. The enforcement mechanism for append-only
observation behavior, curator-vs-import precedence, provider ingestion
boundaries, conflict-review creation, and curation-event generation is
chosen at physical-design time from: constraints, permissions, triggers,
data-access logic, service logic, tests, or a deliberate combination.

## 0a — Legacy non-compliant pipelines (approved)

The legacy Yelp enrichment and Foursquare-API seeding/enrichment pipelines
are permanently stopped (terms-of-service violations). Provider-derived
values (rows AND field-level backfilled values) are excluded from any
retained archive. The purge of legacy data completes with the Step 3B
clean database baseline. Synthetic system-generated reviews are not
described as retainable unless a recorded decision expressly permits their
specific provenance and retention.

## 0b — Hosting-terms posture (resolved)

The project is currently personal and non-commercial; hosting terms were
fully decided in Decision 20 (see source/09), including Vercel Hobby
eligibility conditions and upgrade triggers.
