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

## #113 — Cafe-only global seed expansion (PR #114 OPEN)
- [x] `scripts/seed-cities.ts` config (22 cities, bbox + mode).
- [x] `scripts/seed-osm.ts` refactored to templated Overpass query, supports `--all` / `--all-new`.
- [x] `.ql` files deleted; `package.json` adds `seed:istanbul` / `seed:all-new` / `seed:all`.
- [x] Toronto bbox includes Oakville (south bound 43.40).
- [x] Istanbul seeded live (8741 places).
- [x] Typecheck + lint green.
- [ ] PR #114 reviewed + merged.
- [ ] Run `npm run seed:toronto` (re-seed with GTA bbox).
- [ ] Run `npm run seed:all-new` (19 cafe-only cities, ~15–25 min).

## Open follow-ups (filed today)
- #115 post-seed reclassification: hotel-lobby cafés + Tim Hortons / Dunkin' / Krispy Kreme.
- #116 city-switcher removal → viewport-driven world map.

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

## #194 — Six-city focus (purge + cleanup + perf)
status: IN_PROGRESS
opened: 2026-06-11
steps:
  - [x] full JSON backup (places/refs/reviews) to backups/
  - [x] purge 34,660 places outside six bboxes; relabel 1,963 CVL->Paris
  - [x] fix place_source_refs: backfill place_id (39,873), delete 37,126 orphans
  - [x] trim SEED_CITIES to 6; work-core mode incl. library + office=coworking
  - [x] seeder writes place_id on refs
  - [x] default chips cafe+library+coworking
  - [x] marker bubble memoization (MapContainer)
  - [x] places_in_bbox RPC migration written + applied to prod
  - [x] lint/typecheck/build green; 6-city API smoke test passed
  - [ ] commit, PR, self-review, merge
  - [ ] close #168 (contradicts 6-city scope) + #53 (moot: zero non-system reviews)
notes:
  - npm install was stale (Tailwind v4 migration #189) — build needed reinstall
  - London/NYC/Tokyo/Seoul have 0 baseline ratings — follow-up: generalize seed:baseline
