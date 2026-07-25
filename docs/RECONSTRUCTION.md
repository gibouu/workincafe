# Reconstruction status

**Principle:** one repository, one canonical `main`, one active
architecture, one immutable legacy snapshot
(`archive/pre-reconstruction-2026-07-21`). Long application downtime is
acceptable; accidental repository disorder is not.

## Phase state

- [x] Decision process complete (`docs/decisions/`)
- [ ] Step 0 — snapshot, freeze, owner verifications  ← IN PROGRESS
- [ ] Step 1 — governance (this PR)
- [ ] Step 2A — technology-neutral enforcement
- [ ] Step 2B — approved skeleton + enforcement wiring
- [ ] Step 3A — legacy strip to minimal buildable shell
- [ ] Step 3B — database baseline (chain freezes after this)
- [ ] Step 4 — vertical slices (order in source/11, adjustable per 24b)

## Interim rules

The legacy application tree is reference material pending removal at
Step 3A. Do not extend it, port from it without a decision-backed slice PR,
or treat its patterns as approved. Existing legacy GitHub workflow files
remain historical infrastructure pending Step 3A removal and are not the
target pipeline. Feature work is frozen except reconstruction PRs.
Deployment may be broken or absent until Step 4.

## Legacy references

Snapshot tag: `archive/pre-reconstruction-2026-07-21` (commit `cf66a5c`).
Inspect via `git show archive/pre-reconstruction-2026-07-21:<path>`.
Archived docs: `docs/archive/` (historical, never instructions).
Legacy database: sanitized-archive-then-decommission sequence per
source/02 (Decision 5e) and the Step 0 owner checklist — verification
pending; this document makes no claim about archive status or account
access.
