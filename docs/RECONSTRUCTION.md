# Reconstruction status

**Principle:** one repository, one canonical `main`, one active
architecture, one immutable legacy snapshot
(`archive/pre-reconstruction-2026-07-21`). Long application downtime is
acceptable; accidental repository disorder is not.

## Phase state

- [x] Decision process complete (`docs/decisions/`)
- [x] Step 0 — snapshot, freeze; owner verifications ongoing (registrar/account recovery)
- [x] Step 1 — governance (merged in #318)
- [x] Step 2A — technology-neutral enforcement (merged in #319)
- [ ] Step 2B + 3A — approved skeleton, toolchain, enforcement, and legacy strip
      ← IN PROGRESS (this PR; combined per the 24b sequencing amendment)
- [ ] Step 3B — database baseline (chain freezes after this)
- [ ] Step 4 — vertical slices (order in source/11, adjustable per 24b)

## Interim rules

The legacy application tree has been removed in the Step 2B+3A foundation PR;
its previous state is preserved at the immutable tag. Do not resurrect legacy
code except by porting into the approved structure through a decision-backed
slice PR (cite provenance from the tag). Feature work happens only through
reconstruction slice PRs. The deployed application is a minimal shell until
Step 4 delivers product slices; downtime is acceptable.

## Legacy references

Snapshot tag: `archive/pre-reconstruction-2026-07-21` (commit `cf66a5c`).
Inspect via `git show archive/pre-reconstruction-2026-07-21:<path>`.
Archived docs: `docs/archive/` (historical, never instructions).
Legacy database: sanitized-archive-then-decommission sequence per
source/02 (Decision 5e) and the Step 0 owner checklist — verification
pending; this document makes no claim about archive status or account
access.
