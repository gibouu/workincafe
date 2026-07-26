# Contributing to WorkinCafe

This repository is under **requirement-first reconstruction** (see
[`docs/RECONSTRUCTION.md`](docs/RECONSTRUCTION.md)). Read this file and
[`AGENTS.md`](AGENTS.md) before opening a pull request. These rules apply to
human contributors and to coding agents equally.

## Authority and precedence

Decisions are governed, not ad hoc. Highest wins:

1. Current technical-lead instruction.
2. Ratified operative decision records under `docs/decisions/source/`.
3. The condensed register (`docs/decisions/register.md`) and the deferred
   register (`docs/decisions/deferred-register.md`).
4. `AGENTS.md` and the supporting governance documents.

A technology, dependency, or scope change is approved **only** by an explicit
technical-lead ruling preserved as a decision record. No PR, code comment,
git history, or agent memory can create approval on its own. Anything under
`docs/archive/` is historical and is never authoritative.

## Before you change anything

- **Plan before material change.** Schemas, dependencies, product scope,
  public/shared module boundaries, provider integrations, compliance-bearing
  behavior, or deletion of a substantial shared module require an approved plan
  first. Ordinary refactors, private-symbol cleanup, bounded bug fixes, copy,
  and one-file component work proceed directly. When unsure, ask — do not
  silently widen scope.
- **Product scope is binding.** Items on the do-not-build list in
  `docs/product-scope.md` require a **scope-change issue and a recorded
  decision**, not a PR. Open a *Scope change* issue.
- **Dependencies are allowlisted.** Never add, remove, or major-upgrade a
  dependency on your own. Every dependency in `package.json` must appear in
  `docs/approved-dependencies.json` with an installable status. To request a
  new one, open a *Dependency request* issue. Foreign lockfiles
  (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`) are forbidden.
- **New foundational decisions** use a *Decision proposal* issue → technical-
  lead approval → a new record in `docs/decisions/source/` → register update.

## How to propose things

Use the issue templates (New issue → choose a template):

- **Decision proposal** — a new or amended foundational decision.
- **Dependency request** — adding/removing/upgrading a dependency.
- **Scope change** — building something on the do-not-build list, or changing
  product scope.

## Pull requests

- Branch `feat/<slug>` or `fix/<slug>` off `main`; PRs target protected `main`;
  squash-merge.
- Fill in the PR template honestly — it encodes the definition of done.
- **Port PRs** (reusing legacy code from the snapshot tag
  `archive/pre-reconstruction-2026-07-21`) must cite provenance:
  `ported from archive/pre-reconstruction-2026-07-21:<path> — adapted: <what changed>`.
- During reconstruction, do not extend the legacy application tree or treat its
  patterns as approved; it is reference material pending removal at Step 3A.

## Verification

- Governance invariants: `bash tools/governance-check.sh` (technology-neutral;
  runs today).
- The full `npm run verify` pipeline (format → lint → typecheck → migration
  checks → Tier 1 tests) and technology-specific enforcement (import
  boundaries, dependency-allowlist check, migrate-from-empty) arrive with the
  approved application skeleton in Step 2B. See
  `docs/decisions/source/10-testing.md` and `.../09-operations-hosting-observability.md`.

## No custom GitHub Actions

By decision (19-GH), the launch pipeline is Vercel's Git integration; there are
no custom GitHub Actions workflows. The `CODEOWNERS`, pull-request template, and
issue templates here are GitHub-native configuration, not Actions workflows.

## Target requirements (not yet verified/enabled)

These are recorded requirements, not current guarantees:

- Requiring Code Owner approval (and a non-zero required review count) on `main`
  is an owner-side branch-protection setting to be enabled by @gibouu.
- Repository account recovery, registrar/domain control, and hosting/provider
  account ownership are verified during setup (see `docs/RECONSTRUCTION.md`).
