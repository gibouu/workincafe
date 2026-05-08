# Tasks
One H2 section per task.

## #77 — Cafe-only default + reviewed-place override (PR #84 MERGED)
- [x] Migration `018_user_rating_count.sql` written.
- [x] API exposes `has_user_reviews` + `user_review_count`.
- [x] DemoPlace type extended.
- [x] Filter store defaults to `{cafe}`; `activeCount` ignores the baseline.
- [x] Map page filter override on `has_user_reviews` + `rating > 7` (restaurant gate already in PR #84).
- [x] Quality gate clean.
- [x] Merged (commit `5b43abd`).
- [ ] Apply migration 018 to remote (Supabase MCP).

## #78 — Independent bakeries in default visible set (IN_PROGRESS)
- [x] `isKnownChain(brand)` predicate added to `lib/brand-logos.ts` (reuses `brandLogoFor`).
- [x] `visiblePlaces` filter extended with `isIndependentBakeryWithCafe` clause anchored to `filters.categories.has('cafe')`.
- [x] Lint + typecheck clean.
- [ ] Manual verification: Du Pain et des Idées visible default; Paul / Maison Kayser hidden; Bakery toggle still shows all.
- [ ] PR with `Closes #78. Refs #76.`
- [ ] Squash-merge.

## Open follow-ups (filed)
- #76 tracker (umbrella).
- #78 independent bakeries in default visible set.
- #79 database category audit.
- #80 split fast_food into burger / fast-casual.
- #81 brand→category override (Starbucks-as-fast_food fix).
- #82 add-place "find or confirm" duplicate detection + user-validation.
- #83 quality dedup — note: "seats always full" is a GOOD signal per user (popular work spot), don't deprioritise for that.

## Done in this session burst
- #71 / PR #72 geolocate (permission probe + cache + denial banner).
- PR #73 welcome CTA — user-initiated precise location.
- PR #75 review-submit soft sign-in prompt.
- #56 magic-link, #58 cron, #59 menus, #61/#63 menu PDFs+visibility, #62 cloudinary prune, #64–#69 polish wave, #70 orphan prune.
- Branch protection enabled on main (PR + `verify` required, force-push blocked, admins included).

## Stripe-blocked (deferred)
- #19 Stripe Checkout, #20 camera-based QR scanner.

## #6 — Admin parking lot (TRIAGE)
- Tracker only. Items graduate to their own issues.
