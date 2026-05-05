# Tasks
One H2 section per task.

## #1 — Add-place wizard (DONE)
- [x] PR #2 opened (Closes #1).
- [ ] Awaiting user merge.

## #3 — Address autocomplete fallback on /places/new (IN PROGRESS)
- [ ] Branch off `feat/1-add-place-wizard` (stacks on #2).
- [ ] Add address-only autocomplete via Photon (no `osm_tag` filter) to lookup route.
- [ ] Surface "Or use an address" option in wizard step 1.
- [ ] Captured pick sets lat/lng + formatted address.
- [ ] Quality gate (lint/typecheck/build).
- [ ] Open PR with `Closes #3`.

## #4 — Relax review radius 150 m → 500 m (PENDING)
- Comes after #3.

## #5 — Admin email allowlist (PENDING)
- Allowlist seed: `w5b8s2rpdx@privaterelay.appleid.com`.
- Comes after #3.

## #6 — Admin parking lot (TRIAGE)
- Not work, just a tracker. Items graduate to their own issues.
