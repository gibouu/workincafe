# Tasks
One H2 section per task.

## #14 — iPhone SE polish: drawer scroll + form draft persistence (PR OPEN)
- [x] PlaceCard: vaul snap points `[0.55, 0.95]` so card pulls up to nearly full screen.
- [x] AddPlaceWizard: localStorage draft (`wic:place-new-draft`), restore on mount with toast, clear on submit.
- [x] ReviewForm: per-place draft (`wic:review-draft:<placeId>`) for step + chips + sliders + comment + manual wifi/noise.
- [x] Quality gate (lint/typecheck/build) clean.
- [x] PR #33 opened (Closes #14).
- [ ] Awaiting user merge.

## #15 — Review photo pipeline (NEXT)
- next/image remote loader for the review-photos bucket.
- Per-photo edit/replace in slot grid.
- Pre-publish content moderation (Cloudinary moderation add-on or similar).

## Closed earlier this branch (no action)
- #1 / #2 (add-place wizard), #3 (Photon address autocomplete), #4 (review radius 150→500), #5 (admin allowlist), #11 / #12 (place search bias), #13 / #30 (LiveUpdateSheet wizard), #26 / #29 (admin/place-requests wiring), #31 / #32 (mall chain + Photon payload).

## #6 — Admin parking lot (TRIAGE)
- Not work, just a tracker. Items graduate to their own issues.
