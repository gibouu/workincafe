# Desktop Navigation, Onboarding, Stay Policy, and Mobile Drawer Fix Plan

## Summary

This document describes the later implementation for improving the desktop map layout, onboarding, place detail wording, user contribution education, and mobile place drawer behavior.

The goal is to make desktop navigation visible, add a concise first-use intro, rename "Table-time" to clearer stay-limit language, explain check-ins/live updates/reviews to users, and fix the mobile place drawer so "View full profile" is reachable.

## Desktop Navigation

- Move the `BottomBar` options into a desktop-visible nav row inside `PlaceSidebar`, above the existing `Places` / `Leaderboard` tabs.
- Keep the current mobile `BottomBar` behavior unchanged.
- Desktop nav items should be:
  - `Profile`
  - `Work spots`
  - `Meetups`
  - `Leaderboard`
- `Profile` should route to `/profile`.
- `Work spots` should show the places list.
- `Meetups` can route to the existing partners/waitlist path until the real feature exists.
- `Leaderboard` should switch the existing sidebar tab to `leaderboard`.

## First-Use Intro

- Reuse the existing `/welcome` onboarding style.
- Reuse the existing `wic:onboarded` `localStorage` flag.
- Add or restore map-entry gating so first-time users see `/welcome` before the map.
- Keep onboarding copy short and focused on:
  - finding work spots,
  - using live updates/check-ins,
  - saving and reviewing after sign-in.
- Add an accessible `How it works` entry from desktop navigation and the mobile bottom/profile area so users can reopen the intro later.

## Place Stay-Limit Wording

- Replace the `Table-time` UI label with `Stay limit`.
- Keep the current demo data field, `tabletime_hours`, for now.
- Add a display helper that translates `tabletime_hours` into clearer labels:
  - `tabletime_hours >= 8` -> `∞` or `All day`
  - `1` -> `1h`
  - `2` -> `2h`
  - all other values -> `${n}h`
- Plan a later richer data model for real data:
  - `stay_limit_minutes`
  - `stay_policy_note`
  - `requires_purchase`
  - `lunch_restricted`
- When richer data exists, restaurant/cafe examples should display labels such as:
  - `2h + order`
  - `Not during lunch`
  - `All day`

## User Contribution Explanation

- Add concise contextual text near live update, check-in, and review actions.
- The copy should explain:
  - check-ins and live updates describe what is happening right now,
  - reviews describe a visit or day,
  - users can update a place again later when conditions change.
- Keep this explanation short and UI-native.
- Avoid a large help panel or marketing-style section.

## Review and Contribution Flow

- Rework the full review form so `Overall` is not the first rating.
- Place `Overall` at the end as a suggested final score:
  - auto-generate an initial overall score from the user’s answers,
  - let the user agree with it or manually adjust it,
  - make the algorithm transparent enough that users understand it is a suggestion.
- Remove manual star ratings for Wi-Fi speed and noise when measurement tools work:
  - Wi-Fi should come from the speed test,
  - noise should come from the sound/decibel test,
  - if either tool fails or permission is unavailable, show a fallback manual rating for that item.
- Fix geolocation and Wi-Fi speed test reliability as part of the review work:
  - geolocation currently does not work reliably,
  - Wi-Fi speed test currently does not work reliably,
  - both should show clear failure states and fallback fields instead of blocking the whole review.
- Change price inputs from generic star ratings to concrete ranges:
  - drink price range,
  - food price range,
  - option for `Did not eat`,
  - keep food quality rating only when the user ate food.
- Replace or expand `Atmosphere` into work-friendliness / stay-comfort questions:
  - could you stay as long as you wanted,
  - were staff chill about laptops,
  - were you forced to buy food or keep consuming,
  - did it feel okay to stay several hours,
  - was it good for focused work.
- Replace the `Temperature` star rating with checklist-style environment facts:
  - heating,
  - air conditioning,
  - usually cold,
  - usually warm,
  - comfortable today.
- Add checklist/toggle facts where stars are not the right input:
  - bathrooms available,
  - outlets available,
  - Wi-Fi present,
  - outdoor seating,
  - laptop-friendly,
  - staff-friendly,
  - good for calls,
  - good for quiet focus.
- Any attribute exposed as a user-facing filter should also be captured in reviews or quick updates.
- Example: if `Outdoor seating` is a filter, reviews should ask whether outdoor seating exists and, if useful, whether it is work-friendly.
- Do not add filters that the app has no structured way to collect, verify, or update.
- Ask for current seating/crowding during reviews:
  - many seats available,
  - some seats available,
  - full/crowded,
  - wait/line,
  - this should feed the same aggregate seating status as quick updates/check-ins.
- Ask users to confirm the place type during review:
  - cafe,
  - bakery,
  - library,
  - coworking,
  - hotel lobby,
  - restaurant,
  - fast food,
  - gym / club workspace,
  - other with free text.
- Add `gym` or a broader `club/gym workspace` category in a later taxonomy/schema pass, because some gyms or clubs have work-friendly lounge areas.
- Keep the free-text comment field for anything else future workers should know.
- Add optional photo upload to reviews:
  - photos should be optional,
  - support multiple photos,
  - later categorize photos as food, menu, seating/layout, storefront, vibe, guide/details, or other,
  - categorization can initially happen on the backend or admin side,
  - future AI analysis can sort pictures and identify whether they show food, seating layout, menu, storefront, etc.
- Individual full review detail pages should show review photos grouped by category when available.
- Full place profiles should have a photo carousel/header area:
  - users can swipe through photos,
  - pictures can be grouped or filtered by type,
  - food photos should not be mixed with layout/storefront photos if there is enough data.
- If an owner claims a place, support a menu section:
  - owner-provided menu link or menu images,
  - user-submitted menu photos can still exist separately.
- Rename the scary-feeling `Check in` action:
  - use language like `Quick review`, `Live update`, or `Checked-in review`,
  - make it feel like a small review/update rather than a tracking/check-in event.
- Treat the current quick update sheet as a good base:
  - keep noise, seating, temperature, outlets,
  - add optional speed test and sound test buttons near the relevant choices,
  - add a fifth rotating optional question to fill missing place-profile data.
- Rotating optional questions should be data-gap driven:
  - ask for food/drink price if missing,
  - ask for bathroom availability if unknown,
  - ask for storefront photo if missing,
  - ask for menu photo if missing,
  - ask for outlet availability if unknown,
  - ask for stay policy if unknown.
- Keep optional questions clearly optional; users should be able to submit quick updates without answering them.

## Rating Algorithm

- The final overall rating should be auto-suggested from structured answers.
- Suggested factors:
  - measured Wi-Fi speed,
  - measured noise level,
  - seating availability and comfort,
  - outlet availability,
  - bathroom availability,
  - work-friendliness / stay comfort,
  - price/value,
  - food/drink quality when applicable,
  - temperature/environment facts,
  - place category expectations.
- Example logic:
  - cheap food/drinks plus good quality improves value,
  - fast Wi-Fi improves work score,
  - quiet or appropriate noise improves work score,
  - staff-friendly and long-stay-friendly improves score,
  - no bathrooms, no outlets, forced consumption, or crowded seating reduces score.
- Let users override the generated final score because the algorithm may not understand every situation.
- Store both the algorithm-suggested score and the user-final score in a later schema pass so the algorithm can be evaluated and improved.

## Mobile Place Drawer

- Fix `PlaceCard` / `PlaceCardBody` scroll containment so drawer content can scroll to the bottom.
- Use a clear max-height with the scroll container on one level only.
- Preserve current snap points, rounded top, and visual design.
- Ensure `View full profile` is visible and reachable on small phone viewport heights.
- Fix iPhone back navigation:
  - when inside a place profile or review page on iPhone, the back button should reliably return to the main map,
  - avoid trapping users in nested profile/review flows,
  - preserve selected city/map state where possible.
- Keep the bottom navigation consistently available across major app sections:
  - map,
  - profile,
  - place profile,
  - review flow,
  - waitlist/meetups,
  - future full review detail pages.
- On screens where full bottom navigation would conflict with form submission, use a compact persistent navigation affordance or a clear route back to the map.

## Cluster Zoom Behavior

- Improve map cluster clicks so grouped café/place bubbles zoom in progressively and predictably.
- Current implementation already uses `supercluster` in `MapContainer` and calls `getClusterExpansionZoom(clusterId)` when a cluster is selected.
- Refine that behavior so large groups do not jump too far or stay too dense:
  - Large clusters, for example `300+`, should zoom to a level where they break into medium clusters around `50`.
  - Medium clusters, for example `50-100`, should zoom to a level where they break into smaller clusters around `10`.
  - Small clusters, for example `2-10`, should zoom to the final local area where individual spots are visible when possible.
- Use staged zoom increments instead of one uncontrolled jump:
  - Compute `expansionZoom` from `supercluster`.
  - Compare it with the current approximate zoom from `zoomFromRegion`.
  - Clamp each click to a maximum jump, for example `+2` or `+3` zoom levels.
  - Continue letting repeated clicks drill into the same cluster until individual pins appear.
- When many places remain inside a tight area even at high zoom:
  - reduce individual pin size, for example from `40px` to `28-32px`,
  - reduce cluster bubble size for high-density views,
  - consider a final "spread" or offset layout for overlapping same-block pins if MapKit annotations still cover each other.
- Cluster styling should communicate density:
  - `2-9`: small bubble,
  - `10-49`: medium bubble,
  - `50-199`: larger bubble,
  - `200+`: largest bubble but still not oversized enough to hide the map.
- Keep cluster click behavior centered on the cluster coordinate, but preserve enough context around the surrounding streets so users understand where they zoomed.
- Avoid opening a place card when clicking a cluster; only individual place pins should select/open a place.
- If a cluster cannot expand further because points are too close together, show the smaller pins or spread/offset pins rather than trapping the user in an unclickable cluster.

## Public Interfaces and Types

- No API changes are required for the immediate UI fix.
- No auth, API route, or database schema changes should be included in this UI cleanup.
- Demo type can keep `tabletime_hours` for now.
- A display helper should translate `tabletime_hours` to the user-facing `Stay limit` value.
- Future DB/API planning can reserve richer stay policy fields, but that should not block the immediate UI work.
- No API changes are required for cluster zoom behavior; it should remain client-side in `MapContainer` using existing place coordinates and `supercluster`.
- Later review-schema planning should include structured fields for measured Wi-Fi, measured noise, fallback manual ratings, price ranges, bathrooms, crowding/seating, work-friendliness, place-type confirmation, optional rotating answers, photo metadata, algorithm-suggested score, and user-final overall score.
- Later filter planning should map every filter to a source field and at least one collection point in reviews, quick updates, place requests, owner claims, or admin review.
- Later media planning should include storage, upload limits, moderation, photo category metadata, owner menu media, and cleanup rules for demo/test uploads.

## Test Plan

### Desktop Width

- Nav row is visible above `Places` / `Leaderboard`.
- `Profile` routes to `/profile`.
- `Work spots` shows the places list.
- `Meetups` routes to the waitlist/partners placeholder.
- `Leaderboard` shows the leaderboard panel.

### Mobile Width

- Bottom bar still appears when no place is selected.
- Place drawer scrolls to `View full profile`.
- No bottom content is clipped on small phone viewport heights.

### Onboarding

- First-time visitor sees `/welcome`.
- Dismissed users go directly to the map.
- `How it works` lets users reopen the intro.

### Place Details

- `Table-time` no longer appears.
- Stay limit values render as `∞` / `All day`, `1h`, `2h`, and other hour values.
- Full place profile includes a photo carousel/header once review photos exist.
- Place profile can show menu information when owner-claimed or when menu photos exist.
- Noise and seating are both visible over time, not just noise by hour.

### Review Flow

- Overall rating appears at the end and is auto-suggested from structured answers.
- Wi-Fi and noise use measurement tools first, with manual fallback only on failure.
- Price is captured as drink and food ranges, not stars.
- Food rating is skipped when the user did not eat.
- Temperature uses environment checklist facts instead of a star rating.
- Review asks for bathrooms, current seating/crowding, and confirmed place type.
- Review captures any filterable attributes such as outdoor seating.
- Every visible filter has a matching data collection question/source.
- Optional photo upload works and photos can be categorized later.
- Optional rotating question appears only as an extra, non-blocking prompt.

### Quick Update / Checked-In Review

- The action is renamed away from scary `Check in` language.
- Quick update remains fast and includes optional speed/sound test buttons.
- Seating and noise updates feed aggregate place-status data.
- Optional fifth rotating question helps fill missing profile data.

### Mobile Navigation

- iPhone back button returns to the main map from place profile/review flows.
- Bottom navigation or a compact equivalent remains available across major sections.

### Cluster Zoom

- Clicking a `300+` cluster zooms into smaller regional clusters instead of jumping straight to a confusing dense view.
- Repeated cluster clicks break large clusters into medium clusters, then small clusters, then individual pins.
- Clicking an individual pin still opens the selected place card/profile behavior.
- At high zoom with many nearby places, pins become smaller and remain clickable.
- Dense same-street or same-building places do not remain stuck as one unopenable cluster.

### Commands

Run:

- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Assumptions

- This document is planning-only and should not modify app behavior by itself.
- When implementing code later, avoid changing auth, API routes, or database schema unless explicitly requested.
- `Meetups` is the intended user-facing replacement for the current `Partners` placeholder.
