# Progress Log
[2026-06-11 15:00] ratings parity (#198): re-seeded london/nyc/tokyo/seoul work-core (+~3.4k places; coworking 33 -> 264 via office=coworking), generalized seed:baseline to SEED_CITIES keys w/ bbox filter (old .eq('city') never matched 'Toronto (GTA)'), seeded 17,139 baseline reviews, refreshed mv. All six cities 100% rated on eligible categories. Why: four cities rendered unrated/empty chips.
[2026-06-11 14:05] hotfix (#194): places_in_bbox returned 0 rows for bboxes wider than 180 deg (geography envelope wraps short way) -> empty map at world/continent zoom. Rewrote filter to lat/lng BETWEEN + new places_lng_lat_idx; 9ms plan; applied to prod. Why: geography semantics broke wide viewports.
[2026-06-11 13:10] six-city focus (#194): purged DB 74,724 -> 40,064 places (six bboxes: Paris/GTA/London/NYC/Tokyo/Seoul; full JSON backup in backups/). Fixed place_source_refs: all 76,999 rows had place_id NULL — backfilled 39,873 via hash join, deleted 37,126 orphans, seeder now writes place_id. Relabeled 1,963 'Centre-Val de Loire' rows inside Paris bbox -> 'Paris'. Trimmed SEED_CITIES 33 -> 6, mode 'cafe-only' -> 'work-core' (now incl. libraries + office=coworking). Default filter chips cafe -> cafe+library+coworking. New places_in_bbox RPC (applied to prod via pooler :6543) replaces 2-query viewport path; legacy .in() with 1000 ids silently returned 0 ratings on dense viewports — RPC fixes. Why: focus launch on six cities, cut dead weight.

Newest first. One line per entry.
[2026-05-17 10:39] Edit: .claude/state/PROGRESS.md
[2026-05-17 10:40] admin: #167 final slice → PR #182; /admin/activity feed (API-side union over reviewed_*/resolved_* cols, no migration). Closes #167 (all 4 items shipped). Why: monitoring without an audit-table migration.
[2026-05-17 10:38] Edit: app/admin/page.tsx
[2026-05-17 10:37] Edit: app/admin/page.tsx
[2026-05-17 10:37] Edit: app/admin/page.tsx
[2026-05-17 10:37] Write: app/admin/activity/page.tsx
[2026-05-17 10:37] Write: components/admin/AdminActivityFeed.tsx
[2026-05-17 10:37] Write: app/api/admin/activity/route.ts
[2026-05-17 09:51] Edit: .claude/state/PROGRESS.md
[2026-05-17 09:45] Merged this session to main (2f06a7d): #173(#171 eslint), #176/#177/#180/#181(#167 trust badge/reject presets/bulk approve-reject/bulk dismiss-hide), #175(#174 imported reviews), #179(#178 live-updates feed). Why: cleared the 4-PR train + shipped 6 more.
[2026-05-17 09:37] Edit: app/admin/flagged-reviews/page.tsx
[2026-05-17 09:37] Edit: app/admin/flagged-reviews/page.tsx
[2026-05-17 09:36] Write: components/admin/FlaggedReviewsQueue.tsx
[2026-05-17 09:36] Write: app/api/admin/flagged-reviews/bulk/route.ts
[2026-05-17 09:36] Write: app/api/admin/flagged-reviews/[id]/decision/route.ts
[2026-05-17 09:35] Write: lib/admin/decide-flagged-review.ts
[2026-05-17 09:35] Edit: components/admin/FlaggedReviewRow.tsx
[2026-05-17 09:35] Edit: components/admin/FlaggedReviewRow.tsx
[2026-05-17 09:35] Edit: components/admin/FlaggedReviewRow.tsx
[2026-05-17 09:32] Edit: app/admin/place-requests/page.tsx
[2026-05-17 09:31] Edit: app/admin/place-requests/page.tsx
[2026-05-17 09:31] Write: components/admin/PlaceRequestsQueue.tsx
[2026-05-17 09:31] Edit: components/admin/PlaceRequestRow.tsx
[2026-05-17 09:31] Edit: components/admin/PlaceRequestRow.tsx
[2026-05-17 09:31] Edit: components/admin/PlaceRequestRow.tsx
[2026-05-17 09:30] Edit: components/admin/PlaceRequestRow.tsx
[2026-05-17 09:30] Write: app/api/admin/place-requests/bulk/route.ts
[2026-05-17 09:30] Write: app/api/admin/place-requests/[id]/decision/route.ts
[2026-05-17 09:29] Edit: lib/admin/decide-place-request.ts
[2026-05-17 09:29] Edit: lib/admin/decide-place-request.ts
[2026-05-17 09:29] Write: lib/admin/decide-place-request.ts
[2026-05-17 09:08] Edit: app/admin/page.tsx
[2026-05-17 09:07] Edit: app/admin/page.tsx
[2026-05-17 09:07] Edit: app/admin/page.tsx
[2026-05-17 09:06] Edit: app/admin/page.tsx
[2026-05-17 09:06] Edit: app/admin/page.tsx
[2026-05-17 09:06] Write: app/admin/live-updates/page.tsx
[2026-05-17 09:06] Write: components/admin/AdminLiveUpdatesBrowser.tsx
[2026-05-17 09:05] Write: components/admin/LiveUpdateRow.tsx
[2026-05-17 09:05] Write: app/api/admin/live-updates/route.ts
[2026-05-17 08:14] Edit: .claude/state/PROGRESS.md
[2026-05-17 08:15] reviews #174/PR#175: re-synced onto main after #177 merge (state-log conflict only). Why: serialize the 4-PR merge train.
[2026-05-17 08:01] Edit: .claude/state/PROGRESS.md
[2026-05-17 08:05] admin: shipped #167 slice 2 → PR #177; reject-reason presets + Other on place-requests. Why: faster, consistent rejections.
[2026-05-17 07:58] Edit: .claude/state/PROGRESS.md
[2026-05-17 08:00] admin: shipped #167 slice 1 → PR #176; submitter trust badge on place-requests queue. Why: spot repeat-bad submitters at a glance.
[2026-05-17 07:29] Edit: .claude/state/PROGRESS.md
[2026-05-17 07:30] lint: re-enabled 3 React Compiler eslint rules (#171), refactored map page refs/immutability + GeolocateBlockedBanner, 16 scoped disables; PR #173. Why: stop drift, catch future violations.
[2026-05-17 07:26] Edit: eslint.config.mjs
[2026-05-17 07:26] Edit: components/review/ReviewForm.tsx
[2026-05-17 07:26] Edit: components/review/ReviewForm.tsx
[2026-05-17 07:26] Edit: components/review/ReviewForm.tsx
[2026-05-17 07:26] Edit: components/review/ReviewForm.tsx
[2026-05-17 07:25] Edit: components/review/PhotoSlots.tsx
[2026-05-17 07:25] Edit: components/review/PhotoLightbox.tsx
[2026-05-17 07:25] Edit: components/review/AllReviewsSheet.tsx
[2026-05-17 07:25] Edit: components/layout/SearchPanel.tsx
[2026-05-17 07:25] Edit: components/layout/SearchPanel.tsx
[2026-05-17 07:25] Edit: components/admin/AdminReviewsBrowser.tsx
[2026-05-17 07:25] Edit: components/admin/AdminReviewsBrowser.tsx
[2026-05-17 07:25] Edit: components/admin/AdminPlacesBrowser.tsx
[2026-05-17 07:25] Edit: components/admin/AdminPlacesBrowser.tsx
[2026-05-17 07:24] Edit: app/places/new/AddPlaceWizard.tsx
[2026-05-17 07:24] Edit: app/places/new/AddPlaceWizard.tsx
[2026-05-17 07:24] Edit: app/places/new/AddPlaceWizard.tsx
[2026-05-17 07:24] Edit: app/places/new/AddPlaceWizard.tsx
[2026-05-17 07:24] Edit: app/auth/page.tsx
[2026-05-17 07:24] Edit: components/map/GeolocateBlockedBanner.tsx
[2026-05-17 07:24] Edit: components/map/GeolocateBlockedBanner.tsx
[2026-05-17 07:23] Edit: app/(map)/page.tsx
[2026-05-17 07:23] Edit: app/(map)/page.tsx
[2026-05-17 07:23] Edit: app/(map)/page.tsx
[2026-05-17 07:23] Edit: app/(map)/page.tsx
[2026-05-17 07:23] Edit: app/(map)/page.tsx
[2026-05-17 07:05] Write: /Users/gibou/.claude/plans/lets-look-at-the-encapsulated-trinket.md
[2026-05-10 10:29] Edit: .claude/state/MEMORY.md
[2026-05-10 10:28] Edit: .claude/state/TASKS.md
[2026-05-10 10:28] Edit: .claude/state/DECISIONS.md
[2026-05-10 10:28] Edit: .claude/state/PROGRESS.md
[2026-05-10 10:30] seed: shipped #113 → PR #114; cafe-only seed for 19 cities + Istanbul + GTA (incl. Oakville). Why: first concrete slice of #50 global expansion.
[2026-05-10 10:30] backlog: filed #115 (post-seed reclassification: hotel-lobby cafés + Tim Hortons/Dunkin'/Krispy Kreme) and #116 (city-switcher removal → viewport-driven world map). Why: out-of-scope of #113, tracked separately.
[2026-05-10 10:27] seed: Istanbul live — 8741 places after work-conducive + apartment filters. Why: validated bbox query path end-to-end.
[2026-05-10 10:27] Edit: scripts/seed-cities.ts
[2026-05-10 10:11] Edit: package.json
[2026-05-10 10:10] Write: scripts/seed-osm.ts
[2026-05-10 10:10] Write: scripts/seed-cities.ts
[2026-05-10 10:01] Write: /Users/gibou/.claude/plans/please-look-at-issue-giggly-kahan.md
[2026-05-08 11:10] Edit: .claude/state/TASKS.md
[2026-05-08 11:09] Edit: app/(map)/page.tsx
[2026-05-08 11:08] Edit: app/(map)/page.tsx
[2026-05-08 11:08] Edit: lib/brand-logos.ts
[2026-05-08 11:04] Write: /Users/gibou/.claude/plans/start-fixing-the-next-functional-pebble.md
[2026-05-07 23:52] Write: .claude/state/TASKS.md
[2026-05-07 23:52] Edit: .claude/state/PROGRESS.md
[2026-05-09] tracker #76 + 6 children (#77–#83) filed. PR #84 opened: cafe default + reviewed-place override. Migration 018 written, application pending. Why: curated welcome state.
[2026-05-09] PRs landed today: #56 magic-link, #58 cron, #59 menus, #64–#69 polish, #70 prune, #72 geolocate, #73 welcome CTA, #75 review-submit prompt. Plus branch protection on main. Why: rapid UX fixes after live testing.
[2026-05-09] PR #84 awaiting refinement: restaurant override gated by rating ≥ 7.5 (not just any user review). Why: McDonald's reviews shouldn't surface it; only highly-rated restaurants should.
[2026-05-07 23:51] Edit: .claude/state/DECISIONS.md
[2026-05-07 23:48] Edit: app/(map)/page.tsx
[2026-05-07 23:48] Edit: app/(map)/page.tsx
