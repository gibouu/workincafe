# Tasks
One H2 section per task.

## #17 — Map: spread overlapping pins at max zoom (PR OPEN)
- [x] `lib/map/spread.ts` — `spreadColocated()` buckets unclustered features at zoom ≥18 by ~1m grid, fans groups out in a 5m ring with latitude-aware lng scaling.
- [x] `MapContainer.rebuild()` — substitute displaced coords on `marker.setLngLat()` for points returned by the helper.
- [x] Quality gate clean.
- [x] PR #46 opened (Closes #17).

## Done today (2026-05-07)
- #14 → PR #33 (467f64c): iPhone SE drawer snap points + form draft persistence.
- #34 → PR #35 (8110328): inline FSQ mall children in autocomplete.
- bottom-nav overlap → PR #36 (5473c4c): hide global nav on `/places/new`.
- #15 → PR #42 (6244214): review photos render via `next/image` (`ReviewPhotos` strip + Cloudinary `remotePatterns` + API select).
- #16 → PR #44 (259fca1): "With photos" filter chip + fullscreen `PhotoLightbox` (Esc + arrow keys + body-scroll lock).

## Open follow-ups filed today
- #37 — mall tenant panel on place card (option 2 from #34).
- #38 — operator-side bulk seed of mall children (option 3 from #34).
- #39 — cache FSQ Place Details (deferred until limits bite).
- #40 — pre-publish content moderation (Cloudinary add-on) for review photos.
- #41 — review photo polish: edit affordance, lightbox, slot reorder (lightbox now shipped via #44; polish still open).
- #43 — cursor pagination for AllReviewsSheet (waits for >20 reviews on a place).
- #45 — pre-select "With photos" chip when tapping a thumbnail from the inline place card.

## Pending backlog (untouched)
- #18 — auto-switch active city on IP geolocation.
- #19 / #20 / #21 / #22 / #25 — owner / Stripe flows.
- #23 / #24 / #28 — backend / admin sweeps.

## #6 — Admin parking lot (TRIAGE)
- Tracker only. Items graduate to their own issues.
