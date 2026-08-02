# WorkinCafe — Agent & Developer Rules

Canonical operational rules. Claude Code reads this via `CLAUDE.md`; other
agents read it directly. Rules live here; rationale lives in
`docs/decisions/`.

## Status

This repository is under requirement-first reconstruction (see
`docs/RECONSTRUCTION.md`). The legacy application in this tree is
reference-only and scheduled for removal; it is not a pattern, dependency
source, or architecture. The pre-reconstruction snapshot is the immutable
tag `archive/pre-reconstruction-2026-07-21`.

## Precedence (highest wins)

1. Current technical-lead instruction.
2. Ratified operative decision records under `docs/decisions/source/`.
3. The condensed register (`docs/decisions/register.md`) and deferred
   register (`docs/decisions/deferred-register.md`).
4. `AGENTS.md` and supporting governance documents
   (`docs/architecture.md`, `docs/product-scope.md`,
   `docs/RECONSTRUCTION.md`, `docs/testing/obligations.md`).
5. Code comments.
6. Anything under `docs/archive/` — historical, never instructions.

Agent memory is subordinate to 1–4 and must be corrected on conflict.
A technology, dependency or scope change is approved only by an explicit
technical-lead ruling preserved as a ratified decision record. Other
repository documents, code comments, Git history and agent memory cannot
create approval independently.

## Hard rules

- **Dependencies:** never add, remove, or major-upgrade a dependency —
  propose and stop. Every dependency declared in `package.json` must be
  present in `docs/approved-dependencies.json` with a status permitting
  installation for its implemented use; the installed set may be a subset
  of the allowlist. Foreign lockfiles (`pnpm-lock.yaml`, `yarn.lock`,
  `bun.lock*`) are forbidden.
- **Deferred register:** before proposing any dependency, hosted service,
  workflow system, framework, runtime, database, auth provider, map
  provider, analytics service, or testing tool, check
  `docs/decisions/deferred-register.md` and follow its header rule.
- **Approval before material change:** obtain technical-lead approval
  before changes to schemas, dependencies, product scope, public or shared
  module boundaries, provider integrations, compliance-bearing behavior,
  or deletion of a substantial shared module or externally relied-upon
  contract. Ordinary implementation refactors, deletion of private unused
  symbols, bounded bug fixes, copy changes, and one-file component changes
  may proceed when they remain inside an already approved plan and
  architecture. Flag uncertainty rather than silently broadening scope.
- **Product scope:** `docs/product-scope.md` is binding; its do-not-build
  list requires a scope decision, not a PR.
- **No `src/` directory.** Root-level structure per `docs/architecture.md`.
- **GitHub Actions:** do not add, expand or rely on custom GitHub Actions
  workflows during reconstruction. Existing legacy workflows remain
  historical infrastructure pending their approved removal in Step 3A and
  must not be treated as the target pipeline. The final launch state
  contains no custom GitHub Actions workflows.
- **Migrations:** `drizzle-kit push` is prohibited everywhere. Workflow:
  edit schema → generate → review SQL → migrate. Applied migrations are
  immutable after the Step 3B baseline.
- **GP-1 seeding is operator-initiated only** — never scheduled, automated,
  or triggered by page load (confirmed-workflow compliance rule).
- **Formatting/linting:** Prettier owns formatting; ESLint owns correctness
  and architecture boundaries. No second formatter or linter.
- **Dependency vulnerabilities (Decision 26):** the security gate is
  disposition-based, not "npm audit = 0". Standard-only resolution stays
  mandatory (no overrides/resolutions/aliases/forks/patch-package/canary/
  `--force`/downgrade/suppression). Every `npm audit` advisory must have an
  individual, evidence-backed disposition in
  `docs/security/advisory-dispositions.json`; a reachable unmitigated
  high/critical, or a new/unreviewed advisory, or an unapplied compatible
  standard fix, blocks. `tools/check-security-advisories.mjs` (in `verify`)
  reconciles live audit against the register and never conceals raw output.

## Compliance-bearing rules (non-optional; tests enforce them)

Derived from the confirmed GP-1/GP-2 workflows; change-controlled —
deviations require a new policy inquiry and recorded approval:

- Of data returned by Google Maps Platform or Google Places APIs, only
  Google Place IDs may cross the approved persistence boundary. No other
  Google-derived field or content may be persisted — including review
  text, contextual passages, highlighted text, photo names/URIs/bytes,
  ratings, raw payloads, and ordered result lists — into the database,
  durable caches, logs, analytics, or error reports. This restriction
  applies to Google-derived data only; WorkinCafe-owned canonical data,
  Overture identifiers, Toronto Open Data and DineSafe identifiers and
  signals, operator-authored observations, and approved non-Google
  provenance references are governed by their own decisions.
- Semantic search sends IDs-only requests; results are intersected with
  published WorkinCafe records; unmatched Google businesses are never
  shown; Google relevance order is session-only and never durably stored.
- Contextual enrichment requires exact Place-ID match, is display-only,
  flag-gated, and never persisted.
- All server-side Google Places and Google-content fetches use
  `cache: "no-store"`; Google-content responses send
  `Cache-Control: private, no-store, max-age=0`; Google photo media never
  passes through the Next.js image optimizer or any first-party cache.
  (The Maps JavaScript bootstrap and browser tile loading are governed by
  their own browser-provider behavior.)
- Required Google and reviewer attribution is never separated from
  displayed Google content. Billable calls are accounted once per actual
  outbound attempt and never auto-retried.
- No automatic publication, closure, deletion, or merging of cafés —
  signals create human review tasks only.
- The GP-1 surface (`app/(operator)/gp1/`) is mapless: it never imports
  map components, the Maps loader, or the browser Maps key.
- **Decision 27 (editorial AI assistance; written Google policy guidance in
  `source/14`):** within the auth-gated operator surface only — live-fetched
  Google content may be displayed to the operator (fully attributed) and
  processed **session-only** by the approved no-training model provider
  (Anthropic API) to assist human review; operator-authored review-informed
  notes and **non-reconstructable derived signal values** (which are
  WorkinCafe editorial content, not Google-derived data) may persist.
  Everything above still holds: Google content itself never persists and
  never reaches logs — now explicitly including model prompts/inputs on all
  paths including error paths; models are never trained, tested, validated,
  fine-tuned, **evaluated, or benchmarked** on Google content; meaningful
  human review precedes every editorial action. Material expansion of these
  workflows requires a new policy inquiry referencing the Decision 27 case.

## Canonical commands (available from Step 2B)

`npm run verify` = format:check → lint → typecheck → policy checks
(governance + dependency allowlist + migration static checks) → security
advisory gate (`security:check`, Decision 26) → Tier 1 tests. Also: `npm test`,
`npm run test:watch`,
`npm run db:test` (local Docker PostGIS Tier 2 — required by convention
before review on schema-changing PRs), `npm run db:generate` (no DB URL),
`npm run db:migrate` (fails clearly without direct URL). Vercel build =
`verify` → `next build` → environment-aware migration. Definition of done:
verify green, plan followed or deviations flagged, owned doc tables
updated, no unapproved dependencies, no boundary violations.

## Where things go

Target structure and lint-enforced dependency graph: `docs/architecture.md`.
Exemplars are named there as slices land — copy the exemplar for the
pattern you're implementing; do not invent alternate styles for data
access, forms, state, provider calls, or error shapes.

## Commit/PR conventions

Branches `feat/<slug>` / `fix/<slug>`; PRs to protected `main`;
squash-merge; reference the relevant decision or issue. Port PRs cite
provenance: `ported from archive/pre-reconstruction-2026-07-21:<path> —
adapted: <what changed>`.
