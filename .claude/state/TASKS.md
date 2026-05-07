# Tasks
One H2 section per task.

## #14 — iPhone SE polish: drawer scroll + form draft persistence (DONE)
- [x] PlaceCard snap points + AddPlaceWizard/ReviewForm localStorage drafts.
- [x] PR #33 squash-merged 2026-05-07 (commit 467f64c).

## #34 — Mall-internal stores via FSQ related_places.children (PR PENDING)
- [x] Detect mall hits in FSQ search via category-name keyword match (`shopping mall`, `mall`, `department store`, `shopping plaza`).
- [x] Fetch `related_places.children` for top 2 mall hits in parallel; cap children at 8 per mall.
- [x] Inline children right after their parent in the prediction list with "Inside <Mall>" secondary.
- [x] Quality gate (lint/typecheck/build) clean.
- [ ] PR open + merge.

## #15 — Review photo pipeline (NEXT)
- next/image remote loader for the review-photos bucket.
- Per-photo edit/replace in slot grid.
- Pre-publish content moderation (Cloudinary moderation add-on or similar).

## Closed earlier this branch (no action)
- #1 / #2 (add-place wizard), #3 (Photon address autocomplete), #4 (review radius 150→500), #5 (admin allowlist), #11 / #12 (place search bias), #13 / #30 (LiveUpdateSheet wizard), #26 / #29 (admin/place-requests wiring), #31 / #32 (mall chain + Photon payload).

## #6 — Admin parking lot (TRIAGE)
- Not work, just a tracker. Items graduate to their own issues.
