# Reconstruction status

**Principle:** one repository, one canonical `main`, one active
architecture, one immutable legacy snapshot
(`archive/pre-reconstruction-2026-07-21`). Long application downtime is
acceptable; accidental repository disorder is not.

## Phase state

- [x] Decision process complete (`docs/decisions/`)
- [x] Step 0 — snapshot, freeze; owner verifications complete (see below)
- [x] Step 1 — governance (merged in #318)
- [x] Step 2A — technology-neutral enforcement (merged in #319)
- [x] Step 2B + 3A — approved skeleton, toolchain, enforcement, and legacy
      strip (merged in #320; combined per the 24b sequencing amendment)
- [x] Step 3B — database baseline merged in #323 (Decisions 25, 26). Schema +
      custom SQL + Better Auth; migrate-from-empty verified on local PostGIS
      across two destroy/recreate cycles; dependency-security disposition gate in
      place. The migration chain is **immutable after application**; it freezes
      only when first applied to canonical Neon (pending the deploy step — see
      Decision 20).
- [ ] Step 4 — vertical slices (order in source/11, adjustable per 24b)

## Owner verifications (Step 0/1)

Confirmed directly by the responsible account holders on **2026-07-28**. Only a
minimal, non-sensitive attestation is recorded here; recovery emails/codes, 2FA
details, registrar payment information, private-settings screenshots, and
per-collaborator role lists are deliberately **not** stored in the repository.

```text
GitHub owner recovery: verified privately by repository owner
Registrar and DNS readiness: verified privately by account holder
Main protection configuration: verified by repository owner
Collaborator access: reviewed and approved by repository owner
Verification date: 2026-07-28
```

`main` branch protection is configured and confirmed appropriate by the
repository owner; this document intentionally does not enumerate the specific
protection rules beyond that confirmation. Governance references to a protected
`main` (AGENTS.md, CONTRIBUTING.md) are backed by this confirmation.

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
source/02 (Decision 5e) and the Step 0 owner checklist. This operational
sequence is tracked separately from the four owner attestations above and is
independent of the greenfield reconstruction database; this document makes no
claim about its current archive/decommission status.
