# Native iOS and Launch Optimization Design

**Date:** 2026-07-15
**Status:** Approved direction; implementation planning pending
**Tracking issue:** [#298](https://github.com/gibouu/workincafe/issues/298)

## Objective

Optimize the existing Work in Cafe web and API foundation, then ship a fast, fully native iPhone consumer app through TestFlight and the Apple App Store.

The iOS experience is the priority. The app will use SwiftUI and native MapKit, with no embedded web UI and no cross-platform presentation layer. The existing Next.js application remains the public website, API host, and owner/admin surface. Supabase/PostGIS remains the shared source of truth.

## Product boundary

### iOS v1 includes

- Guest map, search, clustering, and place discovery.
- Native place details, Apple Maps directions, favorites, and profile.
- Native Sign in with Apple and Google authentication.
- Geo-verified reviews and check-ins.
- Wi-Fi measurement and local aggregate noise measurement.
- Review-photo capture and selection when the moderation release gate is satisfied.
- Account export, account deletion, and Sign in with Apple token revocation.
- Universal links for place, authentication, and submission-recovery flows.

### iOS v1 excludes

- Admin and moderation interfaces.
- Owner dashboards, claims, payouts, and deal administration.
- Real deal purchasing and QR scanning.
- Push notifications.
- Background location.
- French localization.
- iPad-specific layouts. The first release is an iPhone target.

The excluded features remain available or continue evolving on the web. They must not delay the iPhone consumer release.

## Current baseline

The starting repository is healthy but not ready for native distribution:

- All 183 Vitest tests, ESLint, TypeScript, and the Next.js production build pass.
- `npm audit --omit=dev` reports no production vulnerabilities.
- `/` currently ships approximately 8.28 MB uncompressed and 1.92 MB gzip of first-load JavaScript.
- The wildcard Phosphor import contributes approximately 5.03 MB uncompressed and 1.04 MB gzip to every route.
- The map route contributes approximately 2.38 MB uncompressed and 626 KB gzip; optional interfaces load eagerly.
- The manifest points to three missing icons, and there is no service worker or Apple touch icon.
- Native clients cannot authenticate protected APIs because the server request path is cookie-only.
- Legal copy, account lifecycle, photo moderation, accessibility, observability, database operations, and device-level testing have release gaps.

These measurements become the baseline for Phase A. Optimization changes must demonstrate an improvement rather than rely on source-level intuition.

## Architecture decision

### Native technology

- Swift 6 language mode.
- SwiftUI for navigation, presentation, forms, sheets, lists, and reusable product components.
- Xcode 26 and the iOS 26 SDK or newer for App Store submission.
- iOS 18.0 minimum deployment target to avoid legacy compatibility branches while retaining a broad recent-device base.
- iPhone device family for v1.
- Native Apple frameworks first; third-party Swift dependencies require a concrete service or contract need.

### Native repository layout

The existing web root stays in place to avoid a disruptive monorepo move. Native code is added alongside it:

```text
ios/
  WorkInCafe.xcodeproj/
  WorkInCafe/
    App/
    Core/
      API/
      Auth/
      Cache/
      Location/
      Measurement/
      Models/
      Photos/
      Support/
    Features/
      Authentication/
      Map/
      Place/
      Profile/
      Review/
      Search/
    Resources/
      Assets.xcassets/
      PrivacyInfo.xcprivacy
  WorkInCafeTests/
  WorkInCafeUITests/
openapi/
  workincafe.yaml
```

Each feature owns its screen, observable state, and feature-specific views. Shared device and networking behavior stays in `Core`. Business logic does not live in SwiftUI `body` implementations.

### API contract

`openapi/workincafe.yaml` becomes the language-neutral contract for the consumer endpoints used by iOS. It defines exact request, response, authentication, error, and pagination shapes.

Swift models and client interfaces are generated with Apple's Swift OpenAPI tooling. Next.js contract tests validate representative responses against the same contract. The existing internal/admin endpoints do not need to migrate before iOS v1.

The first contracted consumer surface covers:

- viewport places;
- place details, reviews, and menus;
- place and location search;
- current user and favorites;
- reviews, check-ins, live updates, Wi-Fi samples, and decibel samples;
- signed photo upload preparation and completion;
- account export and account deletion.

The consumer API uses an explicit version prefix or version header. Breaking changes require a new version; deployed iOS clients cannot be upgraded atomically with the server.

## Native map design

### Map implementation

The native map uses `MKMapView` hosted inside SwiftUI through `UIViewRepresentable`. Pure SwiftUI `Map` is not used as the primary implementation because the product needs direct control over annotation reuse, native clustering, incremental reconciliation, camera-idle behavior, and dense-place performance.

The map coordinator owns:

- `MKMapViewDelegate` callbacks;
- camera and visible-region changes;
- annotation reuse identifiers;
- native clustering identifiers;
- stable place-ID annotation reconciliation;
- selected-annotation state;
- user-location display;
- accessibility labels and actions.

Map annotations contain only stable ID, coordinate, category, short name, brand presentation key, and summary rating. Full place content never sits in annotation objects.

### Viewport loading

1. The map renders the last rounded camera region immediately.
2. The map coordinator publishes a new camera region only after movement settles.
3. The client quantizes that region into a stable request cell and ignores duplicate cells.
4. Any obsolete request is cancelled before the next request begins.
5. Cached place summaries display immediately.
6. A conditional network request refreshes the cell.
7. The returned summaries are diffed by place ID; unchanged annotations stay mounted.
8. MapKit clusters and reuses views natively.

The client never removes and rebuilds the complete annotation set after every camera movement. It also avoids querying at world or continent zoom levels.

### Place selection

Selecting an annotation immediately presents a native sheet using the cached summary. Place details, reviews, and menus begin concurrently. The detail task is keyed by place ID and cancelled when a different place is selected.

Directions use `MKMapItem` to open the venue in Apple Maps. The app does not embed a separate routing engine in v1.

## Native state and concurrency

- Feature state uses focused `@Observable` model types.
- UI-facing model types are `@MainActor`.
- Networking, decoding, cache I/O, image processing, and audio aggregation do not execute on the main actor.
- `URLSession` async/await is the transport.
- An actor-isolated API client coordinates authentication, request deduplication, cancellation, and token refresh.
- An actor-isolated cache stores place summaries and full place results with bounded size and explicit expiry.
- SwiftUI views observe only the properties they render, limiting update propagation.
- Long-running tasks are tied to screen or selection lifetime and are cancelled when their owner disappears.

## Authentication and authorization

### Native session

- Sign in with Apple uses `AuthenticationServices`, a cryptographic nonce, and Supabase ID-token exchange.
- Google authentication uses the system authentication session and a universal-link callback.
- Access and refresh tokens are stored in Keychain, never `UserDefaults`.
- Universal links use `applinks:workin.cafe` and a checked-in `apple-app-site-association` route.
- The planned bundle identifier is `cafe.workin.app`.

### Server request authentication

Protected Next.js API routes accept either:

1. the existing browser session cookie; or
2. `Authorization: Bearer <Supabase access token>` from native clients.

The request actor validates the bearer token with Supabase and constructs a user-scoped client. It must not substitute the service-role client for ordinary native requests. Supabase RLS remains authoritative.

Parity tests execute every protected consumer route with cookie auth, bearer auth, expired bearer auth, missing auth, and a different user's token. A native route must not have broader authorization than the web equivalent.

## Device integrations

### Location

- Core Location runs in foreground only.
- The first permission request follows an explicit user action and an explanation screen.
- The app supports denied, restricted, approximate, temporarily unavailable, and revoked states.
- Exact GPS coordinates are not persisted in clear text.
- The cached startup camera is rounded and represents a viewed map region, not a claim that the user is currently there.
- Review and check-in payloads use a fresh foreground location sample; the server remains the authoritative distance check.

### Noise measurement

- AVAudioEngine or the lowest-level appropriate Apple audio metering API calculates aggregate amplitude locally.
- The app requests microphone permission only when measurement starts.
- Raw audio is never saved, uploaded, or included in diagnostics.
- The app uploads only the derived aggregate and required measurement metadata.
- Audio interruptions, phone calls, route changes, and permission revocation stop the measurement cleanly.

### Photos

- PhotosUI handles library selection.
- AVFoundation camera capture is used only when the user chooses the camera path.
- Images are resized, orientation-normalized, and stripped of unnecessary metadata off the main actor.
- Uploads use the existing signed Cloudinary flow through contracted endpoints.
- Public review photos remain disabled by a server-controlled release flag until moderation, reporting, deletion, and privacy acceptance tests pass.
- Private owner-proof uploads stay web-only in iOS v1.

### Wi-Fi measurement

The native client reuses the existing self-hosted download, upload, and latency endpoints. Measurement phases expose progress and cancellation. The result is best-effort and stays subject to server-side rate and geo checks.

## Cache and offline behavior

The app is network-first for current data and cache-first for startup presentation:

- Tokens live only in Keychain.
- Non-sensitive place summaries and details use a bounded disk cache with schema version and expiry.
- The last rounded map camera and filter selection may persist locally.
- User-entered drafts persist locally until submitted or explicitly discarded.
- Geo-verified writes are never silently replayed later with stale coordinates. A recovered draft requires a fresh location verification and a visible submit action.
- When offline, the app can show cached places and details with a clear stale/offline indicator.
- Map-tile offline downloads are not part of v1.

## Error handling

The native client maps failures into a small typed error vocabulary:

- offline or timeout;
- unauthorized or expired session;
- forbidden;
- rate limited;
- validation failure;
- stale location or geo-verification failure;
- permission denied or restricted;
- service unavailable;
- decoding or contract mismatch;
- unknown server failure.

Behavior is deterministic:

- Read failures keep valid cached content visible and expose a retry action.
- A single expired-token refresh may retry an idempotent request once.
- Authentication failure preserves the user's draft and returns to the originating flow after sign-in.
- A write uses an idempotency key where duplicate submission would be harmful.
- Photo uploads track each file independently and make retry state visible.
- Permission failures link to the relevant Settings recovery path when iOS allows it.
- Contract mismatches are logged without leaking payloads or tokens and fail visibly instead of inventing defaults.
- Native production builds do not treat missing-table 503 responses as successful demo writes.

## Phase A: web and shared-foundation optimization

Phase A completes before native feature expansion beyond the initial map spike.

### Bundle and rendering

- Replace `import * as Phosphor` with a finite, typed registry of explicit icon imports.
- Dynamically load optional review forms, sheets, heatmaps, QR UI, profile panels, and friend panels.
- Keep only the core map and immediately visible controls in the initial map route.
- Render the desktop sidebar only at the desktop layout and the mobile drawer only when opened.
- Virtualize place lists at representative 1,000- and 5,000-place fixtures.
- Add bundle-stat comparison to the verification output and fail on agreed large regressions.

### Web map

- Stop unconditional destruction and recreation of every DOM marker after movement.
- Prefer a MapLibre GeoJSON source with clustered layers for dense markers; retain accessible HTML controls only where their visual or interaction requirements justify them.
- If HTML markers remain, reconcile them by stable place ID and reuse listeners/elements.
- Add keyboard activation, accessible names, focus styling, and an alternate navigable result list.

### Data loading

- Replace the address/review-count detail heuristic with an explicit `isSlim` contract field.
- Use keyed place, review, and menu queries with cancellation, deduplication, stale times, and cache reuse.
- Fetch independent place resources concurrently.
- Clear or key local state so selecting a second place cannot flash the first place's reviews or menus.
- Quantize viewport requests for meaningful CDN reuse.
- Push only verified high-value filtering into the server RPC after measuring current plans through `scripts/db`.

### PWA, responsive behavior, and accessibility

- Add real application icons, a maskable icon, Apple touch icon, favicon, robots, sitemap, and social metadata.
- Add a bounded app-shell/offline fallback. Map-tile caching requires provider-policy and quota review first.
- Add shared safe-area tokens and `viewport-fit=cover` only with portrait, landscape, and installed-mode coverage.
- Keep primary touch targets at least 44 points.
- Prevent landscape phones from switching into an unusable desktop layout.
- Add reduced-motion handling, dialog descriptions, focus trapping/restoration, axe checks, and keyboard coverage.

### Shared release foundation

- Create `scripts/db` and `docs/DATABASE_ACCESS.md` before any database inspection or mutation.
- Replay all migrations against an empty database in CI or a dedicated verification job.
- Regenerate and enforce Supabase types.
- Add production environment validation that fails closed for required services.
- Correct the privacy policy, terms, attribution, processor list, retention details, and fixed legal dates.
- Implement account export and deletion, including associated content cleanup and Apple-token revocation.
- Resolve or document the remaining CodeQL alerts.
- Add production error reporting, uptime/API checks, cron alerting, and a rollback/incident runbook.

## Performance budgets

Performance budgets are release gates, measured on an iPhone 11-class physical baseline device and a current-generation device:

- A cached map is usable within 1.5 seconds of cold launch.
- A warm launch is visibly interactive within 750 milliseconds.
- Selecting a cached annotation produces visible sheet feedback within 100 milliseconds.
- A place sheet with cached summary never waits for full details before presentation.
- Map panning and zooming sustain fluid 60 Hz behavior without recurring hitches above 100 milliseconds under representative city density.
- No networking, JSON decoding, image processing, disk cache I/O, or audio aggregation blocks the main actor.
- Memory remains stable across a scripted 10-minute pan/select/dismiss trace and returns toward baseline after memory warnings and dismissed detail views.
- Location and audio polling stop when their feature is inactive.

XCTest records launch, clock, memory, and signpost metrics. Instruments recordings cover SwiftUI updates, Time Profiler, allocations, energy, networking, and animation hitches. MetricKit and Xcode Organizer provide production feedback without adding a third-party native analytics SDK to v1.

## Testing strategy

### Web and API

- Existing lint, typecheck, unit tests, and production build remain required.
- Add contract-fixture tests for every iOS consumer response.
- Add cookie/bearer authorization parity tests.
- Add Playwright coverage for guest discovery, OAuth return, favorites, review/check-in recovery, export/deletion, and critical legal links.
- Add axe and keyboard-only tests for the web discovery surface.
- Apply database migrations to a disposable Postgres instance and run RLS/contract smoke tests.

### Native unit and integration tests

- Codable fixtures generated from the API contract.
- API client tests with deterministic `URLProtocol` responses.
- Cache expiry, migration, cancellation, and corruption tests.
- Authentication refresh and Keychain adapter tests.
- Map annotation-diff and viewport-quantization tests.
- Location freshness and geo-payload tests.
- Audio aggregation tests using deterministic sample buffers.
- Image resize, orientation, and metadata-removal tests.
- Draft recovery and idempotency tests.

### Native UI and device tests

- XCUITest for first launch, guest map, search, place selection, authentication return, favorites, review drafts, account export, and account deletion.
- VoiceOver labels, reading order, Dynamic Type, contrast, Reduce Motion, and Voice Control checks.
- Denied, approximate, revoked, and interrupted permission scenarios.
- Offline, slow, lossy, and server-error network profiles.
- OAuth return after app termination.
- Background/foreground transitions and memory pressure.
- Photo formats and microphone interruptions on physical iPhones.
- Internal TestFlight followed by external TestFlight before App Review.

### Visual review loop

- Simulator and physical-iPhone behavior are the source of truth for native layout, gestures, performance, accessibility, and system integration.
- Each native UI milestone also updates a localhost HTML companion for rapid browser review.
- The companion preserves prior screen revisions and supports right-click notes saved immediately with page-relative coordinates plus stable route and element identifiers.
- The companion is an annotation and comparison surface only. It does not become production UI, share runtime code with the native app, or weaken native implementation decisions.
- The companion is reopened after every material visual revision, and accepted notes are linked to the implementing issue or PR.

## Privacy and App Store compliance

Before external TestFlight:

- Add purpose-specific location, microphone, camera, and photo-library usage descriptions.
- Add `PrivacyInfo.xcprivacy` and required-reason declarations for the app and included SDKs.
- Complete an accurate App Store Connect privacy inventory.
- Provide in-app account deletion and web-accessible privacy/support URLs.
- Revoke Sign in with Apple credentials during account deletion when applicable.
- Provide review reporting, abusive-user blocking, moderation response, and public contact information for UGC.
- Keep public photos feature-gated off until the complete moderation lifecycle passes.
- Prepare app icon, launch treatment, screenshots, subtitle, description, keywords, support URL, review notes, and reviewer test data.
- Build and upload with Xcode 26 and the required iOS SDK.

## Delivery milestones

The umbrella design is intentionally decomposed into independently reviewable implementation plans:

1. **Web performance cleanup:** bundle, lazy loading, responsive mounting, list virtualization, MapLibre marker reconciliation, caching, PWA shell, and accessibility.
2. **Consumer API and native authentication:** OpenAPI contract, bearer-token actor, universal links, account lifecycle, and parity tests.
3. **Native shell and read-only map:** Xcode project, design system, cache, MapKit coordinator, clustering, search, place sheet, and directions.
4. **Native write and device flows:** authentication UI, favorites, reviews/check-ins, location, Wi-Fi, audio, photos, and draft recovery.
5. **Release safety:** moderation gate, legal/privacy, database operations, observability, VoiceOver, XCUITest, performance profiling, and physical-device matrix.
6. **TestFlight and App Store:** signing, App Store Connect assets, internal/external beta, review fixes, submission, and monitored rollout.

Each milestone produces independently testable software and receives its own issue, branch, test plan, PR, and self-review. Native map work may begin as a narrow spike after the API shapes are frozen, but consumer feature expansion waits for the Phase A and authentication gates.

## Risks and mitigations

- **Two frontends can drift.** The OpenAPI contract and shared fixtures are the boundary; the native app never scrapes or copy-pastes web behavior.
- **Map density can regress performance.** Native clustering, annotation reuse, viewport thresholds, physical-device traces, and explicit budgets gate release.
- **A server change can break installed clients.** Consumer APIs are versioned and additive within a version.
- **OAuth can fail after process termination.** Universal-link and terminated-app return tests are required before TestFlight expansion.
- **Photo UGC can block review.** The remote feature gate defaults off until moderation and deletion are proven.
- **Native delivery can expand into owner/admin parity.** The product boundary is explicit; excluded web surfaces do not move into iOS v1.
- **Optimizing the web app can delay native work.** Phase A prioritizes measured P0/P1 findings and shared API/compliance foundations; unrelated backlog work remains outside the release path.

## Completion definition

The program is complete when:

- measured web optimization targets and regression checks are in place;
- the contracted consumer APIs support secure cookie and bearer clients;
- the native app meets functional, privacy, accessibility, and performance acceptance criteria on physical devices;
- internal and external TestFlight gates pass;
- the App Store submission is accepted and the release is monitored with documented rollback and incident procedures.

## Primary references

- [Submitting apps to the App Store](https://developer.apple.com/app-store/submitting/)
- [MapKit annotation clustering](https://developer.apple.com/documentation/mapkit/mkannotationview/cluster)
- [Understanding and improving SwiftUI performance](https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance)
- [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [User privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/)
- [Swift OpenAPI Generator](https://github.com/apple/swift-openapi-generator)
