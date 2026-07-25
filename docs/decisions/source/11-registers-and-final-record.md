# Operative decision records — Decisions 23–24: registers and final record

## Decision 23 — Deferred-technology register (ratified 2026-07-24)

One consolidated register at `docs/decisions/deferred-register.md`,
created in Step 1. Purpose: prevent unsupported re-proposals; preserve
triggers across context loss; distinguish deferred options from rejected
options, fallbacks, version gates, and permanent rules; point to source
records. Authority: the register is an index and summary; if a summary
conflicts with its cited source decision, the source controls until
explicitly amended. Entries carry: technology/capability, category,
disposition, source decision, trigger/changed-fact where applicable,
reconsideration restrictions. Agents and developers check the register
before proposing a listed item. A technology may not be adopted merely
because: a newer agent prefers it; it is popular; it appears in a
template; it became stable without satisfying recorded conditions; it
would theoretically solve an undemonstrated problem.

Review rules: (1) review an entry when a recorded trigger occurs; (2) a
trigger initiates reconsideration, never automatic adoption; (3) adoption/
rejection/recategorization requires a new recorded decision; (4) milestone
reviews at first external users, commercialization, significant team
growth, major hosting/architecture change; (5) no scheduled review
ceremony; (6) adopted items keep a short historical entry linking the
superseding decision; (7) triggers/rationales change only through recorded
decisions — no silent edits; (8) fallbacks are candidates, not
pre-approved implementations.

Categories A–F ratified as populated in `deferred-register.md`, including
the amendments: automated E2E includes Playwright **and Cypress**; the
node:test trigger is the total-setup-simplicity test; the backup fallback
reads "may be evaluated as a temporary option through the required new
backup decision"; rejected-at-launch additions (React Hook Form; Cypress
as separate runner; an OSM canonical place-data layer; any second coequal
form/state/primitive/test framework without a new decision; bulk automatic
canonical import from any place source; automatic canonical record
merging); "rejected at launch" means changed facts plus a new decision are
required — not that a technology is universally bad. Category F records
permanent/change-controlled rules (human-review canonicals; GP-1/GP-2
bindings; Google-content boundaries binding all future adoptions; product
semantic invariants) — never trigger-based deferrals. Confirmations: the
six ratification confirmations recorded (permanent-rule classification;
GP change control; fallbacks not pre-approved; triggers require new
decisions; source authority; historical entries on adoption).

## Decision 24 — Final integrated record (ratified 2026-07-24; process closed)

Sections 1–6 of the consolidated record are the authoritative
implementation index, never silently weakening/broadening/replacing source
decisions. Wording corrections applied: framework = latest stable,
security-supported release at the foundation PR, exact version recorded in
lockfile and architecture record, no permanent textual pin to a point
line; forms = plain Server Actions for redirect-only/simple commands,
`useActionState` only where returned state is needed; GP-1 phrasing =
change-controlled compliance rule.

Reconstruction plan approved with clarifications: Step 0 uses the
immutable tag only (no archive branch; "archive/* protection" = tag and
evidence protection); the one-time database archive is a reconstruction/
compliance artifact, not backup automation; Step 1 governance must not
imply nonexistent shared ownership; Step 2A rules remain understandable
without the final stack; Step 2B establishes the root-level skeleton and
enforcement with **no placeholder exemplars**; Step 3A = minimal valid
shell; Step 3B = PostgreSQL 17 + PostGIS + Better Auth tables + canonical
schema + journal + reviewed baseline + immutability + legacy decommission
sequence; Step 4 slice order (1 schema/auth/admin; 2 ingestion/matching/
GP-1/candidate queue; 3 public map/list/detail; 4 name + semantic search;
5 enrichment/contextual/photos; 6 hardening/curation/verification/docs) is
implementation guidance — reorderable on dependency practicality without a
new architecture decision; product scope and compliance never change via
reordering.

Gap rulings: **G1** Prettier (dev-only; one config; one ignore file; no
plugins; no Tailwind class sorting; no competing formatter; no ESLint
formatting duplication; `format`/`format:check`; format:check first in
verify; no Biome). **G2** ESLint built-in `no-restricted-imports` +
reviewed path patterns as the initial boundary mechanism; small
filesystem/module tests only where ESLint cannot express a rule;
eslint-plugin-boundaries governance-gated. **G3** no `@types/*` wildcard —
only companions to installed approved dependencies (@types/node,
@types/react, @types/react-dom, @types/pg if required, @types/google.maps);
`server-only`/`client-only` allowed as markers, installed only if setup
requires; `import "server-only"` mandatory in server env config, database
access, Better Auth server config, Google server integrations, operator
server utilities; `client-only` only where genuinely beneficial;
`"use client"` unchanged; the pinned shadcn CLI is an implementation tool.
**G4** Google's official Dynamic Library Import bootstrap
(`google.maps.importLibrary`), contained in the Maps client adapter: one
loader operation per page; dedupe concurrent loads; required libraries
only; no unnecessary Places preloading; key from the public env module;
release-channel respect (stable only); CSP-nonce propagation readiness;
normalized failures; declarative adapter surface; no loader/provider
handles outside the adapter; never loaded in GP-1; @googlemaps/js-api-
loader governance-gated. **G5** launch curation target ≈100 published
cafés, quality-first (full language in docs/product-scope.md); not a hard
gate; bulk import to hit numbers prohibited. **G6** no GitHub organization
transfer before reconstruction; the current repository remains canonical
for the personal phase provided (Target requirement — verified during
Step 0/1): both developers hold required access; owner recovery works;
branch protection and review rules configurable adequately; Vercel
receives required Git integration; no credential/artifact exists only in
an unrecoverable personal account; redeployment/recovery instructions
documented privately. Transfer = deferred operational governance;
reconsider on: private-repo collaboration changes, commercialization,
legal-entity ownership, more developers, operational need for shared
administration, ownership blocking protection/recovery controls.

Final allowlists: dependency and service allowlists as embodied in
`docs/approved-dependencies.json` and the service list (GitHub; Vercel
Hobby under conditions; Neon; Google Cloud/Maps Platform for the approved
workflows; the independent workin.cafe registrar). No launch accounts for
deferred services. Documentation hierarchy: AGENTS.md; product-scope;
architecture; RECONSTRUCTION; decisions/; deferred-register; testing
obligations; approved-dependencies.json — links and short summaries, no
full-decision duplication.

Seventeen closure confirmations recorded, including: process complete;
source decisions authoritative; `main` canonical; immutable tag, no legacy
branch; root structure without `src/`; Vercel Git integration as the only
launch pipeline; no custom GitHub Actions workflows in the final launch
state; no backups/observability/analytics/scheduler/queue at launch;
Vitest-not-Vite; Prettier sole formatter; built-in ESLint restrictions;
dependency-free Maps bootstrap; ~100-café target; deferred org transfer;
latest-stable-security-patched version policy; no unapproved dependency or
service may enter the reconstruction.
