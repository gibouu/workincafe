# Native WorkinCafe Product Rebuild Design

**Date:** 2026-07-19
**Status:** Approved
**Tracking issue:** [#310](https://github.com/gibouu/workincafe/issues/310)
**Branch:** `feat/310-native-product-rebuild`

## Objective

Transform the merged native MapKit MVP into a polished, responsive, accessible SwiftUI implementation of the complete WorkinCafe consumer product.

The native app must immediately feel like WorkinCafe and clearly belong to the same product as `https://www.workin.cafe/`. It must not look like a generic Apple Maps shell, a web page mechanically rebuilt in SwiftUI, or a cosmetic wrapper around the existing MVP.

The application remains fully native:

- Swift 6 and SwiftUI for product presentation.
- `MKMapView` hosted through `UIViewRepresentable` for dense map discovery.
- Apple frameworks first.
- No embedded web product UI.
- No cross-platform presentation layer.

## Source-of-truth order

When sources disagree, use this order:

1. The live web application.
2. Current web source, API routes, schemas, models, and tests.
3. Current product copy and checked-in assets.
4. The approved native representative slice described here.
5. Previous product specifications where they still match the live product.
6. The current native MVP.

The old master specification remains useful for product intent, category identity, review dimensions, and visual vocabulary. Its PWA-only and MapKit JS platform decisions are superseded by the approved native program.

## Hard release rule

The existing MVP archive and screenshot are technical artifacts only.

No archive may be exported, uploaded, or submitted until all of the following are true:

- the finished app has received explicit visual approval in Simulator;
- the approved visuals have been verified at 320, 393, and 430 point widths;
- the parity matrix has no unexplained launch-critical gaps;
- native and web verification gates pass;
- accessibility, privacy, account lifecycle, backend safety, and device-performance gates pass;
- App Store screenshots are captured from the finished approved build.

No visual element from the MVP is preserved solely because it already exists.

## Product boundary

### Native consumer product

The native program covers the real consumer experience supported by the live product and backend:

- onboarding and location education;
- map and list discovery;
- custom category and brand markers;
- clustering and selected-marker behavior;
- search, filters, and supported sorting;
- selected-place preview;
- full place details;
- directions and sharing;
- reviews and live updates;
- favorites and saved places;
- native authentication and session restoration;
- profile and account lifecycle;
- Add a place and supported contribution flows;
- Cowork profile and honest unavailable/empty states;
- deep links and submission recovery;
- loading, empty, error, permission, and offline states;
- performance, accessibility, privacy, and release compliance.

### Web-only or deferred surfaces

The following remain web-only unless the parity audit discovers a launch-critical consumer dependency:

- admin and moderation interfaces;
- owner dashboards and business claims;
- Stripe onboarding, payouts, and deal administration;
- real deal purchasing and QR scanning;
- push notifications;
- background location;
- French localization;
- iPad-specific layouts.

Unsupported or incomplete web features must be represented honestly. The native app must not imply that Cowork matching, deal purchasing, detailed profile stats, live measurements, or account controls work unless the complete backend path exists and is verified.

## Approved design direction

The approved direction is a faithful but more polished native interpretation of the web product.

The web remains authoritative for:

- brand identity;
- colors;
- typography hierarchy;
- information architecture;
- place-card content;
- review experience;
- filters;
- visual tone;
- product terminology;
- overall density and personality.

iOS owns:

- navigation hierarchy;
- sheets and detents;
- gestures;
- safe-area behavior;
- Dynamic Type;
- VoiceOver and focus order;
- haptics;
- native controls;
- reduced motion;
- permission recovery;
- platform-standard sharing, maps, and authentication.

## Approved representative slice

The representative slice was compared against the live mobile web product at small, current, and large iPhone viewport sizes. It establishes the design system for the remaining screens.

### Main discovery

- The map is the primary discovery canvas.
- There is no large WorkinCafe title capsule over the map.
- A single safe-area-aware search surface combines the search entry point and filter access.
- A compact Map/List control makes list discovery a first-class alternative.
- Current location and Add place remain restrained map actions.
- The bottom product dock retains the web terminology: Profile, Work spots, and Cowork.
- Work spots is the default product mode.
- Deeper screens hide the dock when it would compete with task-specific actions.

### Markers and clusters

- Place markers are custom circular `MKAnnotationView` subclasses, not `MKMarkerAnnotationView`.
- Default marker size is approximately 32 points with a two-point white ring and controlled shadow.
- Selected markers grow to approximately 42 points and receive a restrained white emphasis ring.
- Category identity uses the canonical WorkinCafe colors.
- Known brands may use the canonical monogram and brand color when available.
- Clusters use neutral charcoal rather than system blue so category identity remains dominant.
- Cluster size scales by count without becoming the primary visual element.
- Marker motion is limited to selection and cluster-camera transitions and respects Reduce Motion.

### Selected-place preview

- Selection opens a native bottom sheet at a useful medium detent.
- The preview immediately displays category identity, name, address or neighborhood, distance, work rating, and essential status.
- High-value work attributes appear as compact chips, such as Wi-Fi, noise, and outlets.
- Primary actions are View work spot, Save, and Directions.
- The sheet can be dragged to expand.
- A cached summary appears immediately while full resources load.
- Map selection remains visibly selected until the preview is dismissed or another place is selected.

### Full place details

- Full details are a real `NavigationStack` destination rather than a thin MapKit-style sheet.
- The hierarchy is:
  1. place identity and category;
  2. address, neighborhood, and distance;
  3. work rating, review count, and average spend;
  4. directions, save, share, and review actions;
  5. six work vitals;
  6. current live conditions;
  7. opening information and supported business fields;
  8. reviews;
  9. reporting, correction, provider, and ownership links where supported.
- A safe-area action bar keeps the highest-value actions reachable.
- Unsupported and null values are omitted rather than replaced with invented data.

### Search

- Search uses a full-height native searchable sheet or destination.
- It accepts place names, addresses, neighborhoods, and cities where the backend supports them.
- Dense result rows show category, name, supporting location metadata, distance, open state, and rating when available.
- Quick filters may appear beneath the search field when they use real collected data.
- Results combine cached/visible places with server search.
- Active results recompute when the source data changes.
- Selecting a result moves the map, retains selection, and opens the place preview.
- No-result states suggest clearing filters, moving the map, or trying another term.

### Filters

- Filters use a native sheet.
- Category selection retains WorkinCafe category colors and terminology.
- Binary values use native toggles.
- Small mutually exclusive sets use segmented controls or accessible selection rows.
- Active filters remain visible and individually removable.
- The sticky primary action includes an honest result count when available.
- Only filters backed by structured collection, API semantics, and real data are shown.
- Rating thresholds use the actual 1–10 product scale.

## Visual system

### Category palette

| Category | Color | Native semantic symbol |
| --- | --- | --- |
| Café | `#6B4F3B` | coffee/cup equivalent |
| Bakery | `#D4A574` | bakery/bread equivalent |
| Library | `#2C3E50` | book equivalent |
| Coworking | `#16A085` | briefcase/work equivalent |
| Hotel | `#8E44AD` | bed equivalent |
| Restaurant | `#C0392B` | fork-and-knife equivalent |
| Fast food | `#E67E22` | burger equivalent |
| Other | `#5A5A60` | map-pin equivalent |

Bakery and other light backgrounds require an explicit accessible foreground rather than assuming white.

### Semantic colors

- primary action: `#007AFF` / dynamic iOS equivalent;
- positive or available: `#34C759`;
- destructive or unavailable: `#FF3B30`;
- caution or measurement: `#FF9500`;
- primary text: semantic label;
- secondary text: semantic secondary label informed by `#6B7280`;
- tertiary text: semantic tertiary label informed by `#9CA3AF`;
- map surfaces: native material with WorkinCafe tinting only where it does not reduce contrast.

Semantic dynamic colors must preserve the WorkinCafe palette in dark mode and increased-contrast environments.

### Typography

- Use SF Pro through SwiftUI semantic text styles.
- Preserve the web hierarchy rather than literal pixel sizes.
- Place names and primary screen identity use strong, compact display hierarchy.
- Metadata remains dense but must scale under Dynamic Type.
- Important values use tabular numbers where comparison matters.
- Truncation must not hide the primary place identity or critical status.

### Spacing, radii, and shadows

- Primary spacing rhythm: 8, 12, 16, 20, and 24 points.
- Compact segmented selections use approximately 8-point radii.
- Fields use approximately 12-point radii.
- cards, buttons, and metric tiles use approximately 16-point radii.
- major sheets and feature surfaces use approximately 24-point continuous radii.
- the bottom product dock uses a full capsule or approximately 32-point radius.
- shadows are restrained and used to establish elevation over the map, not decoration.

### Motion and haptics

- Selection, successful filter application, save state, contribution completion, and important validation may use light platform haptics.
- Camera movement, sheet presentation, selection, and state change are the only routine animations.
- Decorative movement is excluded.
- Reduce Motion disables scaling and substitutes opacity or immediate transitions.

## Native information architecture

### Primary modes

The application has three product modes that match the live product mental model:

- Work spots;
- Cowork;
- Profile.

Each mode owns a `NavigationStack` path. The dock changes modes but does not become the owner of feature state.

Work spots owns map/list discovery, search, filters, place selection, and saved-state presentation within discovery.

Cowork owns the real social profile and matching surface supported by the backend. Until matching exists, it presents an honest signed-out, setup, waitlist, empty, or unavailable state rather than synthetic people.

Profile owns authentication entry, saved places, reviews, contributions, account settings, export, deletion, support, privacy, and legal links where implemented.

### Focused flows

- Add place is a full-screen two-step flow: Find it, then Describe it.
- Authentication is a focused full-screen flow that returns to the originating task.
- Review and live-update flows preserve drafts and resume after authentication.
- Search and filters are native sheets or destinations tied to discovery state.
- Selected-place preview is a sheet; full details are navigated content.

## Architecture

### Composition root

`AppEnvironment` is the single composition root and provides:

- consumer API clients;
- authenticated transport;
- session and Keychain storage;
- cache;
- location services;
- image loading and processing;
- measurement services;
- analytics and signposts;
- clock and deterministic test dependencies.

Dependencies must not be constructed inside individual SwiftUI views.

### Routing

`AppRouter` owns:

- selected product mode;
- a navigation path per primary mode;
- presented sheet or full-screen flow;
- deep-link parsing;
- post-authentication return destinations;
- submission-recovery destinations.

Routing contains no network or feature business logic.

### Feature boundaries

```text
App/
  AppEnvironment
  AppRouter
  RootProductDock
Core/
  API/
  Auth/
  Cache/
  DesignSystem/
  Images/
  Location/
  Measurement/
  Models/
  Photos/
  Support/
Features/
  Discovery/
    Map/
    List/
    Search/
    Filters/
  Place/
    Preview/
    Detail/
    Reviews/
  Authentication/
  Favorites/
  Profile/
  Review/
  LiveUpdate/
  CheckIn/
  AddPlace/
  Cowork/
```

### State ownership

- `DiscoveryStore` owns active mode, query, filters, sort, visible result IDs, selected place ID, and viewport cell.
- `MapDataModel` owns cache/network lifecycle for viewport cells and stale-response rejection.
- `MapCoordinator` owns only MapKit configuration, camera, annotations, clustering, selection rendering, and accessibility actions.
- `SearchModel` owns the active query, cached results, remote results, and result-generation identity.
- `FilterModel` owns supported filter values and server-compatible serialization.
- `PlaceDetailModel` owns cached summary presentation and keyed concurrent detail, review, and menu loading.
- `SessionStore` owns Keychain-backed authentication, refresh, restoration, and sign-out.
- `FavoritesStore` owns server-backed optimistic save/unsave with rollback.
- Review, live update, check-in, and Add place each have independent state machines and draft persistence.

Views observe only the properties they render. Expensive work and decoding do not execute on the main actor.

## Map implementation

Keep `MKMapView` and the audited coordinator infrastructure, then strengthen it:

- use a supported muted standard configuration where available;
- exclude unrelated points of interest;
- preserve useful geographic context and neighborhood labels;
- apply camera zoom limits;
- prevent world and continent viewport queries;
- quantize viewport request cells;
- debounce settled camera changes;
- cancel obsolete requests;
- reject late responses using request identity, not cancellation alone;
- normalize or split antimeridian bounds;
- deduplicate and validate place IDs before reconciliation;
- reconcile stable annotations instead of rebuilding them;
- persist and restore a rounded camera with matching cached data;
- synchronize map and list selection;
- retain the selected marker state;
- expose explicit location and permission recovery states;
- add performance signposts around camera settling, fetch, decode, diff, and apply.

Only public MapKit APIs may be used. If MapKit cannot remove an exact highway shield or cartographic detail, use the closest supported muted style and document the limitation.

## Data and API design

### Contract strategy

The complete consumer surface requires a versioned, stable contract for native clients.

The native consumer contract will be OpenAPI-defined, with generated Swift models and a narrowly wrapped transport. Existing public read routes may be used during the first discovery slice behind protocols, but broad authenticated UI must not ship against ad hoc cookie-only contracts.

The contracted surface covers:

- viewport places;
- search and geocoding;
- place details, reviews, and menus;
- current user and profile;
- favorites;
- reviews, live updates, check-ins, Wi-Fi, and noise samples;
- Add place and validation;
- upload preparation and completion when photos are enabled;
- account export and deletion.

### Authentication

- Protected routes accept existing browser cookies or a validated Supabase bearer token.
- Native access and refresh tokens live in Keychain.
- Sign in with Apple uses AuthenticationServices and a cryptographic nonce.
- Google uses the system authentication session and secure callback handling.
- RLS remains authoritative.
- Service-role clients are not substituted for ordinary native requests.
- Cookie and bearer authorization tests must prove parity.

### Backend truthfulness

Before exposing a feature natively, correct or document backend gaps found in the audit:

- live updates currently do not provide authoritative geo verification;
- some measurement fields are ignored;
- many detail vitals are defaults or unknown;
- rating filters contain legacy scale assumptions;
- guest favorites do not reliably migrate to an authenticated account;
- profile stats and Cowork matching are incomplete;
- account export and deletion are promised but not implemented end to end;
- deal purchasing is not a real consumer payment flow.

Native UI must never mask these gaps with local fake success.

## Cache and offline behavior

- Cache viewport summaries by quantized cell with schema version, timestamp, expiry, and size bound.
- Persist the rounded camera that matches the cached startup cells.
- Cache full place details, review pages, and menus independently.
- Tokens remain Keychain-only.
- Non-sensitive drafts persist until submitted or discarded.
- Offline launch displays coherent cached map/list content and an explicit stale/offline state.
- Read failures retain valid cached content.
- Geo-verified writes are never silently replayed with stale coordinates.
- A recovered write draft requires a fresh location verification and a visible user submit action.

## Error and permission behavior

The native error vocabulary includes:

- offline or timeout;
- unauthorized or expired session;
- forbidden;
- rate limited;
- validation failure;
- geo-verification failure;
- permission denied or restricted;
- service unavailable;
- decoding or contract mismatch;
- unknown server failure.

Behavior rules:

- Read failures keep valid cached content visible and provide retry.
- An expired token may refresh and retry an idempotent request once.
- Authentication failure preserves the task and draft, then returns after sign-in.
- Optimistic favorites roll back when the server rejects or fails the write.
- Duplicate-harmful writes use idempotency keys.
- Permission failures explain recovery and link to Settings when allowed.
- Contract mismatches fail visibly and are logged without payloads, tokens, or precise coordinates.
- Blank screens, indefinite spinners, generic dead ends, silent fake success, and raw null values are prohibited.

Major screens deliberately cover initial loading, refresh, cached content, empty results, offline state, permission denial, authentication expiry, server error, partial data, and retry.

## Accessibility

The map is never the only discovery path.

The native app must support:

- complete list discovery;
- semantic Dynamic Type without clipped primary content;
- VoiceOver names, values, hints, traits, and predictable order;
- 44-point minimum interactive targets;
- non-color selected and status indicators;
- increased contrast;
- Reduce Motion;
- keyboard and focus management;
- announced validation and submission errors;
- accessible rating controls;
- accessible markers and clusters;
- meaningful image descriptions;
- explicit filter selection state.

A VoiceOver user must be able to discover, search, filter, inspect, save, review, and access profile/account functions without using map gestures.

## Performance design

The app should be materially faster and more responsive than the web product.

Measure and budget:

- cold and warm launch;
- cached time to first useful content;
- map gesture frame hitches;
- camera-settle-to-annotation update;
- API and decode duration;
- search and filter latency;
- image loading and list scroll;
- repeated screen transitions;
- offline launch;
- memory under dense map interaction.

Implementation rules:

- no synchronous networking;
- no large decoding or image processing on the main actor;
- request cancellation plus stale-generation rejection;
- no duplicate viewport requests;
- no rebuilding unchanged annotations;
- bounded paginated review loading;
- display-sized images and bounded image caches;
- focused observable state to avoid broad SwiftUI invalidation;
- screen-lifetime task cancellation;
- signposts for the critical discovery and detail path.

## Testing and verification

### Unit tests

Cover API decoding/errors, bounds and antimeridian behavior, cell quantization, cache expiry, stale request rejection, cancellation, duplicate IDs, annotation reconciliation, search refresh, filters, sorting, mode behavior, opening hours, review validation, favorites, authentication state, deep links, and contribution validation.

### Contract and integration tests

Cover public and authenticated consumer responses, cookie/bearer parity, session restoration, favorites synchronization, review submission, Add place, pagination, upload state, and offline cache behavior. Write tests use fixtures or a safe test environment and never mutate production content.

### UI tests

Cover launch, map/list switching, search, filters, selection, preview expansion, full details, reviews, signed-out submission, favorites, Add place, Cowork states, denied location, offline recovery, deep links, Dynamic Type, and draft recovery.

### Visual regression

Reference screenshots cover:

- Work spots map and list;
- branded markers and clusters;
- selected-place preview;
- full place details;
- search;
- filters;
- reviews and review form;
- Add place;
- saved places and profile;
- Cowork states;
- loading, empty, error, offline, and permission states.

Verify at 320 × 568, 393 × 852, and 430 × 932 point-class layouts. Native Simulator and physical-device behavior are authoritative. The localhost companion remains the annotation and before/after comparison surface.

### Baseline evidence

Recorded before specification commit:

- web: 63 files and 184 tests passed;
- native: 12 unit tests across 8 suites passed;
- native UI: guest-discovery launch test passed;
- CoreSimulator access must run outside the restricted command sandbox on this machine.

## Implementation sequence

1. Complete parity matrix and visual-system documentation.
2. Establish `AppEnvironment`, router, design tokens, fixtures, and deterministic UI-test mode.
3. Implement the approved branded discovery vertical slice.
4. Fix discovery correctness, caching, concurrency, and performance gaps.
5. Complete place detail reads and review presentation.
6. Define and verify the versioned consumer API and bearer-auth boundary.
7. Implement native authentication and session recovery.
8. Complete favorites, saved places, reviews, live updates, check-ins, profile, account lifecycle, Add place, and honest Cowork states.
9. Complete loading, empty, error, permission, offline, accessibility, and performance passes.
10. Expand unit, contract, integration, UI, and visual-regression verification.
11. Run independent code and product-parity review.
12. Run release audit, obtain explicit Simulator visual approval, then create a signed archive.

Implementation uses coherent milestone commits and preserves the stable technical infrastructure identified by the audit.

## Acceptance standard

Completion means a polished native WorkinCafe consumer product—not merely a building app, working map, or improved screenshot.

The finished result must:

- retain the WorkinCafe identity and product intent;
- feel faster and more direct than the web product;
- use native iPhone interaction patterns;
- provide complete non-map discovery;
- never fake unsupported backend behavior;
- pass the defined product, visual, performance, accessibility, privacy, and release gates;
- receive explicit visual approval before export or submission.
