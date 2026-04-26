# Outstanding work

Living list of what's planned but not yet shipped. Add to it when you defer something; remove items as they land. Sister docs:
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — what currently exists.
- [`./conventions.md`](./conventions.md) — invariants.
- [`./supabase-auth-setup.md`](./supabase-auth-setup.md) — operator runbook.

## Ideas needing a decision before work starts

- **Drag-style scale instead of segmented buttons** for noise / wifi (users want continuous slider feel). Today `ScaleRow` is 5 segmented buttons with end labels. Slider with snap-to-tick is straightforward but touch interaction needs care.

## Aesthetics / UX

- iPhone-only: validate the place card drawer truly scrolls to the bottom on the smallest viewport heights (single `h-[88dvh]` snap; full profile + reviews are inlined).
- Compact persistent nav for forms (review form, add-place sheet) so users always have a route home without losing draft state. Today only the X button in the header takes them out.
- Place card scroll: confirm that on smallest viewports (iPhone SE) the inlined Reviews section is still reachable.

## Review form

- Photo uploads (multiple, optional, server-side category later). Needs storage choice (Vercel Blob vs Supabase Storage), moderation rules, and DB columns.
- Owner-claim menu attachments (separate from user-submitted photos).
- Persist `overall_suggested` vs `overall_user_set` so the algorithm can be evaluated (already in payload; needs DB column).
- Wi-Fi/noise are measurement-first: the speed-test and decibel-test fill the rating automatically and the `ScaleRow` label shows the measured value. User can override; override clears the "measured" annotation. The raw mbps/dB are already POSTed to `/api/wifi-tests` and `/api/decibel` whenever the test ran, regardless of override.

## Live update / quick review

- "Live review" chip on the place card opens the LiveUpdateSheet directly. Fillable without auth or geo; submit is gated by 401 → draft + redirect-to-login.
- Inline optional speed-test + sound-test buttons live in the sheet now. Sound test auto-fills the noise question (dB → quiet / moderate / loud).
- Surface "you need to sign in" inline (not just on submit) when no Supabase session is detected — currently the user only finds out after pressing Submit.

## All reviews sheet

- Done: search + sort (newest / top / low / verified). Same on mobile + desktop.
- When photos ship, add a "with photos" filter chip and let users tap into a photo to expand.
- When real reviews land, paginate (currently shows the entire pool of demo reviews per place).

## Schema migration (Phase B SQL)

The review form currently sends fields the API silently ignores. To land them:

- `reviews.drink_price_range`, `reviews.food_price_range`, `reviews.ate_food`
- `reviews.environment_facts text[]`, `reviews.work_facts text[]`
- `reviews.place_type`, `reviews.current_seating`
- `reviews.overall_suggested smallint`, `reviews.overall_user_set bool`
- `live_updates.outlets`, `live_updates.rotating_question text`, `live_updates.rotating_answer text`
- Photo metadata (when photos ship): `review_photos { id, review_id, url, category, ... }`

Until this lands, the API treats unknown payload keys as no-op (route handler enumerates known columns).

## Cluster zoom + pin density

- Pin size now scales with zoom (40 → 32 → 28 px at zoom ≥16 / ≥18). Cluster click clamped to +3 zoom levels.
- Open: if pins still overlap at max zoom for same-block places, apply an offset/spread layout (today they sit at the exact same coord and stack invisibly).

## IP-based geolocation

- `/api/geo` returns Vercel-injected lat/lng/city/country. Map page pans to the result if within 80 km of the active city.
- Future: if the IP city matches a known city in `CITIES`, switch the active city automatically. Today we only nudge the map.

## Auth (operator side, not code)

The submit-time auth code path is in place. The remaining work is operator-side and lives in [`./supabase-auth-setup.md`](./supabase-auth-setup.md):

- Enable Google + Apple providers in the Supabase dashboard.
- Add the production + preview redirect URLs to the allow list.
- One end-to-end test of the live review submit flow.

## Filters ↔ collection points

Convention: every filter must have a structured collection point.

- Outdoor seating: collected by the LiveUpdateSheet rotating question (`has_outdoor`). Sufficient for now.
- Bathroom availability: collected by the rotating question. Promote to a dedicated review field if it becomes a popular filter.
- (No `lighting` filter exists in `lib/store/filters.ts` despite the demo data carrying a `lighting` field — leave the data; don't expose a filter without a collection point.)

## Doc maintenance

- Update `ARCHITECTURE.md` whenever a route, store, or surface is added.
- New invariants go in `conventions.md`, not in CLAUDE.md.
- Don't reintroduce per-feature design docs in `docs/` once a feature ships — capture surviving wisdom in `conventions.md` and the architecture index instead.
