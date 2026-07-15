# Native Authenticated and Device Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native authentication, favorites, geo-verified contributions, Wi-Fi/noise measurement, photos, and safe draft recovery to the SwiftUI app.

**Architecture:** Feature models consume the generated `/api/v1` client and a shared `SessionStore`; AuthenticationServices and ASWebAuthenticationSession handle provider entry while Keychain owns credentials. Core Location supplies fresh foreground-only samples at submit time, AVAudioEngine emits aggregate amplitude only, network measurement is cancellable, and PhotosUI/AVFoundation feed an off-main image pipeline. Drafts persist content but never exact coordinates; every geo write requires visible resubmission and a new location.

**Tech Stack:** Swift 6, SwiftUI, AuthenticationServices, Supabase Swift 2.51.0, Security/Keychain, CoreLocation, Network, AVFoundation, Accelerate, PhotosUI, ImageIO, XCTest, XCUITest.

## Global Constraints

- Tracking issue: [#303](https://github.com/gibouu/workincafe/issues/303); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- Hard dependencies: issues #301 and #302 must be merged; all writes use `/api/v1` and bearer auth.
- Location and microphone are foreground-only and requested only after a user action plus explanation.
- Draft persistence contains form content and selected local image references, never exact GPS coordinates, microphone buffers, OAuth tokens, or Cloudinary signatures.
- Review/check-in submission requires a sample no older than 120 seconds, horizontal accuracy at most 150 meters, and server distance at most 150 meters.
- Raw audio is never saved, uploaded, logged, placed in crash reports, or retained after the aggregate calculation.
- Public review photos remain hidden and upload preparation remains unavailable unless the fail-closed server release flag is true.
- Every commit and PR body ends with `— gib` and contains no AI trailer.

---

## File map

- Auth/session: `ios/Packages/WorkInCafeCore/Sources/WorkInCafeCore/Auth/`, `ios/WorkInCafe/Core/Auth/`, `ios/WorkInCafe/Features/Authentication/`.
- Contribution state: `ios/WorkInCafe/Core/Drafts/`, `ios/WorkInCafe/Features/{Favorites,Review,CheckIn,LiveUpdate}/`.
- Devices: `ios/WorkInCafe/Core/{Location,Measurement,Photos}/`.
- Tests: matching folders under `ios/WorkInCafeTests/` plus `ios/WorkInCafeUITests/AuthenticatedFlowsTests.swift` and `DevicePermissionTests.swift`.

### Task 1: Integrate native Apple/Google authentication and session recovery

**Files:**
- Modify: `ios/Packages/WorkInCafeCore/Package.swift`
- Modify: `ios/project.yml`
- Create: `ios/WorkInCafe/Core/API/AuthenticatedConsumerAPI.swift`
- Create: `ios/WorkInCafe/Core/API/LiveAuthenticatedConsumerAPI.swift`
- Create: `ios/WorkInCafe/Core/Auth/SessionStore.swift`
- Create: `ios/WorkInCafe/Core/Auth/AppleAuthorizationController.swift`
- Create: `ios/WorkInCafe/Core/Auth/GoogleWebAuthenticationController.swift`
- Create: `ios/WorkInCafe/Features/Authentication/SignInView.swift`
- Create: `ios/WorkInCafe/Features/Authentication/AuthenticationFeatureModel.swift`
- Create: `ios/WorkInCafeTests/Auth/SessionStoreTests.swift`
- Create: `ios/WorkInCafeTests/Auth/AuthenticationFeatureModelTests.swift`
- Create: `ios/WorkInCafe/App/AppEnvironment.swift`
- Create: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`
- Modify: `ios/WorkInCafe/App/WorkInCafeApp.swift`
- Modify: `ios/WorkInCafe/App/AppRootView.swift`

**Interfaces:**
- Produces: `SessionStore`, `FavoritesAPI`, `LiveAuthenticatedConsumerAPI`, `AppEnvironment`, provider adapters, and origin-preserving sign-in completion.
- Consumes: read-only `ConsumerAPI`, `NativeAuthClient`, `UniversalLinkRouter`, Keychain store, and generated bearer client from issues #301/#302.

- [ ] **Step 1: Pin the official Supabase Swift auth package**

Add to `WorkInCafeCore/Package.swift`:

```swift
.package(url: "https://github.com/supabase/supabase-swift", exact: "2.51.0")
```

Expose only the `Auth` product inside the core package; no feature view imports Supabase directly.

- [ ] **Step 2: Write the failing cold-launch refresh test**

```swift
@Test("restores and refreshes an expired Keychain session before protected work")
@MainActor
func restoreExpiredSession() async {
    let client = MockNativeAuthClient(stored: .expired)
    let store = SessionStore(client: client)
    await store.restore()
    #expect(client.refreshCallCount == 1)
    #expect(store.state == .authenticated(.fresh))
}
```

- [ ] **Step 3: Verify the session store is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Auth`

Expected: FAIL because `SessionStore` does not exist.

- [ ] **Step 4: Implement provider entry and origin recovery**

```swift
@Observable @MainActor
final class SessionStore {
    enum State: Equatable { case restoring, guest, authenticating, authenticated(CurrentUser), failed(AuthError) }
    private(set) var state: State = .restoring
    private(set) var pendingDestination: AppLink?

    func requireAuthentication(returningTo destination: AppLink) {
        pendingDestination = destination
        state = .authenticating
    }
}

struct CurrentUser: Sendable, Equatable {
    let id: UUID
    let displayName: String?
    let email: String?
    let providers: Set<AuthProvider>
}

enum AuthError: Error, Sendable, Equatable {
    case cancelled
    case invalidCallback
    case sessionExpired
    case offline
    case server
}

protocol FavoritesAPI: Sendable {
    func favoritePlaceIDs() async throws -> Set<UUID>
    func setFavorite(placeID: UUID, isFavorite: Bool) async throws
}

struct AppEnvironment {
    let consumerAPI: any ConsumerAPI
    let authenticatedAPI: any FavoritesAPI
    let placeCache: any PlaceCaching
    let sessionStore: SessionStore
    let linkRouter: any UniversalLinkRouting
}
```

`AppEnvironment.live()` constructs these dependencies in `AppEnvironment.swift`; under `#if DEBUG`, `AppEnvironment.uiFixture(arguments:)` delegates to `UIFixtureServices`. `WorkInCafeApp` creates exactly one environment and injects it into the root; production always selects `.live()`. Debug/UI-test builds may select `.uiFixture(arguments:)`; `ios/project.yml` excludes `UIFixtureServices.swift` from Release compilation, while unit-test helpers stay in the test target. Apple uses `ASAuthorizationAppleIDButton`, SHA-256 nonce, ID token, and authorization code. Google uses `ASWebAuthenticationSession` with ephemeral-session false and the associated-domain return. Scene URLs route through `UniversalLinkRouter`; auth callbacks are exchanged by `SessionStore`, then `AppRootState` opens the exact pending favorite/review/check-in/live-update destination. Cancellation preserves the draft and returns to guest state.

- [ ] **Step 5: Verify and commit**

Run: `swift test --package-path ios/Packages/WorkInCafeCore && scripts/ios-test --only WorkInCafeTests/Auth`

Expected: Apple nonce, Google callback, expired refresh, invalid session clear, cancellation, and pending-destination tests PASS.

```bash
git add ios/project.yml ios/Packages/WorkInCafeCore ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Auth ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/Features/Authentication ios/WorkInCafe/App ios/WorkInCafeTests/Auth
git commit -m "feat: add native sign in flows" -m "— gib"
```

### Task 2: Add authenticated favorites with optimistic rollback

**Files:**
- Create: `ios/WorkInCafe/Features/Favorites/FavoritesStore.swift`
- Create: `ios/WorkInCafe/Features/Favorites/FavoriteButton.swift`
- Create: `ios/WorkInCafeTests/Favorites/FavoritesStoreTests.swift`
- Modify: `ios/WorkInCafe/Features/Place/PlaceSheet.swift`
- Create: `ios/WorkInCafe/Features/Profile/ProfileScreen.swift`

**Interfaces:**
- Produces: `FavoritesStore.contains(_:)`, `toggle(_:)`, and `load()`.
- Consumes: authenticated v1 favorites endpoints and `SessionStore`.

- [ ] **Step 1: Write failing optimistic rollback tests**

```swift
@Test("failed favorite write restores previous state")
@MainActor
func rollback() async {
    let api = MockFavoritesAPI(setResult: .failure(.offline))
    let store = FavoritesStore(api: api, initial: [])
    await store.toggle(.placeAID)
    #expect(store.contains(.placeAID) == false)
    #expect(store.error == .offline)
}
```

- [ ] **Step 2: Verify the store is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Favorites`

Expected: FAIL on missing `FavoritesStore`.

- [ ] **Step 3: Implement actor-safe optimistic behavior**

Update the UI immediately, issue idempotent PUT/DELETE, roll back only if the same place has no newer operation, and request sign-in with `.place(id)` destination when guest.

`ProfileScreen` is introduced here: guests see a native sign-in action; authenticated users see their cached favorite count and a virtualized favorite-place list keyed by UUID. Account export/deletion and moderation actions are added by issue #304, so the initial screen exposes no dead controls.

- [ ] **Step 4: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Favorites`

Expected: load, add, remove, double-tap ordering, guest sign-in return, offline rollback, and unauthorized refresh cases PASS.

```bash
git add ios/WorkInCafe/Features/Favorites ios/WorkInCafe/Features/Place/PlaceSheet.swift ios/WorkInCafe/Features/Profile ios/WorkInCafeTests/Favorites
git commit -m "feat: add native favorites" -m "— gib"
```

### Task 3: Add foreground location service and fresh-sample policy

**Files:**
- Create: `ios/WorkInCafe/Core/Location/LocationService.swift`
- Create: `ios/WorkInCafe/Core/Location/LocationPermission.swift`
- Create: `ios/WorkInCafe/Core/Location/VerifiedLocationSample.swift`
- Create: `ios/WorkInCafe/Core/Location/LocationPolicy.swift`
- Create: `ios/WorkInCafeTests/Location/LocationPolicyTests.swift`
- Create: `ios/WorkInCafeTests/Location/LocationServiceTests.swift`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`

**Interfaces:**
- Produces: `LocationProviding.sample(purpose:) async throws -> VerifiedLocationSample`.
- Consumes: `CLLocationManager` only while the foreground feature is active.

- [ ] **Step 1: Write failing freshness/accuracy tests**

```swift
@Test("accepts only recent accurate samples")
func locationPolicy() throws {
    let now = Date(timeIntervalSince1970: 1_000)
    #expect(throws: LocationError.inaccurate) {
        try LocationPolicy.validate(.fixture(capturedAt: now - 5, accuracy: 151), now: now)
    }
    #expect(throws: LocationError.stale) {
        try LocationPolicy.validate(.fixture(capturedAt: now - 121, accuracy: 20), now: now)
    }
}
```

- [ ] **Step 2: Verify location types are missing**

Run: `scripts/ios-test --only WorkInCafeTests/Location`

Expected: FAIL on missing `LocationPolicy`.

- [ ] **Step 3: Implement permission and async sample behavior**

```swift
protocol LocationProviding: Sendable {
    func sample(purpose: LocationPurpose) async throws -> VerifiedLocationSample
}

enum LocationPurpose: Sendable, Equatable {
    case locateOnMap
    case review(placeID: UUID)
    case checkIn(placeID: UUID)
    case liveUpdate(placeID: UUID)
    case wifiSample(placeID: UUID)
    case noiseSample(placeID: UUID)
}

struct VerifiedLocationSample: Sendable, Equatable {
    let latitude: Double
    let longitude: Double
    let horizontalAccuracyMeters: Double
    let capturedAt: Date
}
```

Support `.notDetermined`, `.denied`, `.restricted`, `.approximate`, `.authorized`, `.temporarilyUnavailable`, and revocation. Start updates only for an explicit map-locate or contribution action; resume continuations once; stop the manager on success, error, cancellation, backgrounding, or revocation.

- [ ] **Step 4: Prove no exact-location persistence**

Add a source/persistence regression test scoped to user-owned session, draft, and measurement records. Assert `VerifiedLocationSample` is not `Codable`, no encoded draft/session/measurement fixture contains `latitude` or `longitude`, and no exact user location reaches disk or logs. Public venue coordinates and rounded, non-user camera regions in `PlaceCache` are explicitly allowed.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Location`

Expected: denied/restricted/approximate/revoked/cancelled/timeout/fresh sample cases PASS and manager stop calls are balanced.

```bash
git add ios/WorkInCafe/Core/Location ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/App ios/WorkInCafeTests/Location
git commit -m "feat: add foreground location verification" -m "— gib"
```

### Task 4: Add draft-safe reviews, check-ins, and live updates

**Files:**
- Create: `ios/WorkInCafe/Core/Drafts/DraftStore.swift`
- Create: `ios/WorkInCafe/Core/Drafts/SubmissionDraft.swift`
- Create: `ios/WorkInCafe/Features/Review/ReviewFeatureModel.swift`
- Create: `ios/WorkInCafe/Features/Review/ReviewForm.swift`
- Create: `ios/WorkInCafe/Features/CheckIn/CheckInFeatureModel.swift`
- Create: `ios/WorkInCafe/Features/LiveUpdate/LiveUpdateFeatureModel.swift`
- Create: `ios/WorkInCafeTests/Drafts/DraftStoreTests.swift`
- Create: `ios/WorkInCafeTests/Review/ReviewFeatureModelTests.swift`
- Create: `ios/WorkInCafeTests/CheckIn/CheckInFeatureModelTests.swift`
- Modify: `ios/WorkInCafe/Core/API/AuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/Core/API/LiveAuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`

**Interfaces:**
- Produces: versioned content-only drafts, visible `submit()` state machines, and `ContributionAPI`.
- Consumes: `SessionStore`, `LocationProviding`, generated v1 mutation models, and UUID idempotency keys.

- [ ] **Step 1: Write failing stale-replay and draft-redaction tests**

```swift
@Test("recovered geo draft requires a new location and visible submit")
@MainActor
func recoveredDraft() async throws {
    let draft = ReviewDraft.fixture(savedAt: .distantPast)
    let location = MockLocationProvider()
    let model = ReviewFeatureModel(draft: draft, location: location, api: MockContributionAPI())
    #expect(model.state == .editingRecoveredDraft)
    #expect(location.callCount == 0)
    await model.submit()
    #expect(location.callCount == 1)
}
```

- [ ] **Step 2: Verify draft/feature types are missing**

Run: `scripts/ios-test --only WorkInCafeTests/Drafts --only WorkInCafeTests/Review --only WorkInCafeTests/CheckIn`

Expected: FAIL on missing modules.

- [ ] **Step 3: Implement versioned content-only drafts**

```swift
struct ReviewDraft: Codable, Sendable, Equatable {
    static let schemaVersion = 1
    let id: UUID
    let placeID: UUID
    var ratings: ReviewRatings
    var comment: String
    var localPhotoIDs: [UUID]
    let savedAt: Date
}

struct ReviewRatings: Codable, Sendable, Equatable {
    var overall: Int
    var wifi: Int?
    var noise: Int?
    var seating: Int?
    var outlets: Int?
    var food: Int?
    var foodValue: Int?
    var currentBusyness: Int?
    var temperatureFeel: Int?
    var coffeeQuality: Int?
    var coffeeArt: Int?
    var coffeeMug: Int?
}

struct LiveUpdatePayload: Codable, Sendable, Equatable {
    var noise: String?
    var seating: String?
    var temperature: String?
    var outlets: String?
    var rotatingQuestion: String?
    var rotatingAnswer: String?
}

protocol ContributionAPI: Sendable {
    func submitReview(_ draft: ReviewDraft, location: VerifiedLocationSample, idempotencyKey: UUID) async throws -> UUID
    func submitCheckIn(placeID: UUID, studyingUntil: Date?, location: VerifiedLocationSample, idempotencyKey: UUID) async throws -> UUID
    func submitLiveUpdate(placeID: UUID, payload: LiveUpdatePayload, location: VerifiedLocationSample, idempotencyKey: UUID) async throws -> UUID
}
```

`LiveUpdatePayload` validates `noise` against `quiet/moderate/loud`, `seating` against `plenty/some/full`, `temperature` against `cold/comfortable/warm/hot`, `outlets` against `many/some/none`, and both rotating strings at 80 characters before transport. Every non-`nil` rating is an integer from 1 through 10. No location or auth data is part of any Codable draft type; `VerifiedLocationSample` deliberately has no `Codable` conformance. Store atomically, cap drafts to 20, expire after 30 days, and surface corruption/expiry as a user-visible discard result.

- [ ] **Step 4: Implement explicit submit state machines**

States are `editing`, `editingRecoveredDraft`, `verifyingLocation`, `submitting`, `submitted`, and `failed(SubmissionError)`. Generate one idempotency UUID per visible attempt and retain it only while retrying the same payload. Authentication interruption preserves the draft and returns to the originating form.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Drafts --only WorkInCafeTests/Review --only WorkInCafeTests/CheckIn`

Expected: recovery, sign-in return, fresh location, duplicate retry, cancellation, offline, validation, and server geo-failure tests PASS.

```bash
git add ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Drafts ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/Features/Review ios/WorkInCafe/Features/CheckIn ios/WorkInCafe/Features/LiveUpdate ios/WorkInCafe/App ios/WorkInCafeTests
git commit -m "feat: add safe native contribution drafts" -m "— gib"
```

### Task 5: Implement cancellable Wi-Fi measurement

**Files:**
- Create: `ios/WorkInCafe/Core/Measurement/WiFiMeasurement.swift`
- Create: `ios/WorkInCafe/Core/Measurement/WiFiMeasurementService.swift`
- Create: `ios/WorkInCafe/Features/Review/WiFiMeasurementView.swift`
- Create: `ios/WorkInCafeTests/Measurement/WiFiMeasurementTests.swift`
- Modify: `ios/WorkInCafe/Core/API/AuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/Core/API/LiveAuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`

**Interfaces:**
- Produces: `WiFiMeasuring.measure() -> AsyncThrowingStream<WiFiMeasurementEvent, Error>` and `WiFiSampleAPI.submitWiFiSample(...)`.
- Consumes: `/api/speedtest/ping`, `/api/speedtest/blob`, and `/api/speedtest/upload`; result submission uses `/api/v1/wifi-samples`.

- [ ] **Step 1: Write failing deterministic clock/math tests**

```swift
@Test("converts transferred bytes and duration into megabits per second")
func throughput() {
    #expect(WiFiMeasurement.megabitsPerSecond(bytes: 5_000_000, seconds: 2) == 20)
}

@Test("cancellation stops the active URLSession tasks")
func cancellation() async {
    let transport = ControlledSpeedTransport()
    let task = Task { try await WiFiMeasurementService(transport: transport).measureToCompletion() }
    task.cancel()
    await #expect(throws: CancellationError.self) { try await task.value }
    #expect(transport.cancelledRequestCount == 1)
}
```

- [ ] **Step 2: Verify the measurement module is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Measurement/WiFiMeasurementTests`

Expected: FAIL on missing module.

- [ ] **Step 3: Implement progress phases and bounds**

Emit `.latency(progress)`, `.download(progress)`, `.upload(progress)`, and `.complete(result)`. Use five ping samples and median latency, a bounded 10 MB download, bounded 5 MB upload, 20-second total timeout, and cooperative cancellation. Never claim ISP-certified speed.

Extend `LiveAuthenticatedConsumerAPI` with:

```swift
protocol WiFiSampleAPI: Sendable {
    func submitWiFiSample(placeID: UUID, measurement: WiFiMeasurement, location: VerifiedLocationSample, idempotencyKey: UUID) async throws -> UUID
}
```

- [ ] **Step 4: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Measurement/WiFiMeasurementTests`

Expected: unit conversion, median, progress ordering, timeout, HTTP failure, cancellation, and result encoding tests PASS.

```bash
git add ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Measurement/WiFiMeasurement* ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/Features/Review/WiFiMeasurementView.swift ios/WorkInCafe/App ios/WorkInCafeTests/Measurement/WiFiMeasurementTests.swift
git commit -m "feat: add native Wi-Fi measurement" -m "— gib"
```

### Task 6: Implement aggregate-only ambient noise measurement

**Files:**
- Create: `ios/WorkInCafe/Core/Measurement/NoiseAggregate.swift`
- Create: `ios/WorkInCafe/Core/Measurement/NoiseMeter.swift`
- Create: `ios/WorkInCafe/Core/Measurement/AudioBufferAggregator.swift`
- Create: `ios/WorkInCafe/Features/Review/NoiseMeasurementView.swift`
- Create: `ios/WorkInCafeTests/Measurement/AudioBufferAggregatorTests.swift`
- Create: `ios/WorkInCafeTests/Measurement/NoiseMeterTests.swift`
- Modify: `ios/WorkInCafe/Core/API/AuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/Core/API/LiveAuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`

**Interfaces:**
- Produces: `NoiseMeasuring.measure(duration:) async throws -> NoiseAggregate` and `NoiseSampleAPI.submitNoiseSample(...)`.
- Consumes: AVAudioEngine tap buffers in memory; submits aggregates to `/api/v1/decibel-samples`.

- [ ] **Step 1: Write failing deterministic sample-buffer tests**

```swift
@Test("aggregates RMS into dBFS without retaining samples")
func aggregate() {
    var aggregator = AudioBufferAggregator()
    aggregator.consume([0.5, -0.5, 0.5, -0.5])
    let result = aggregator.finish(duration: 1)
    #expect(abs(result.meanDBFS - (-6.0206)) < 0.01)
    #expect(aggregator.retainedSampleCount == 0)
}
```

- [ ] **Step 2: Verify the aggregator is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Measurement/AudioBufferAggregatorTests`

Expected: FAIL on missing module.

- [ ] **Step 3: Implement aggregate-only math and lifecycle**

Use Accelerate for sum-of-squares, clamp silence before `20 * log10(rms)`, retain running count/sum/peak only, and label results as an approximate ambient noise estimate rather than calibrated dBA. Include `algorithmVersion = 1`, duration, mean dBFS, and peak dBFS.

Extend `LiveAuthenticatedConsumerAPI` with:

```swift
protocol NoiseSampleAPI: Sendable {
    func submitNoiseSample(placeID: UUID, aggregate: NoiseAggregate, location: VerifiedLocationSample, idempotencyKey: UUID) async throws -> UUID
}
```

- [ ] **Step 4: Stop on every interruption path**

Request microphone permission only after start. Stop/remove taps on completion, cancellation, phone/audio interruption, route change, backgrounding, engine error, permission revocation, and view dismissal. Diagnostics contain state/error code only.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Measurement/AudioBufferAggregatorTests --only WorkInCafeTests/Measurement/NoiseMeterTests`

Expected: silence/RMS/peak, permission, interruption, cancellation, route-change, and no-retained-samples tests PASS.

```bash
git add ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Measurement/Noise* ios/WorkInCafe/Core/Measurement/AudioBufferAggregator.swift ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/Features/Review/NoiseMeasurementView.swift ios/WorkInCafe/App ios/WorkInCafeTests/Measurement
git commit -m "feat: add private noise aggregation" -m "— gib"
```

### Task 7: Implement gated photo selection, processing, capture, and upload

**Files:**
- Create: `ios/WorkInCafe/Core/Photos/ReviewPhoto.swift`
- Create: `ios/WorkInCafe/Core/Photos/ReviewImageProcessor.swift`
- Create: `ios/WorkInCafe/Core/Photos/ReviewPhotoUploadService.swift`
- Create: `ios/WorkInCafe/Core/Photos/CameraCaptureController.swift`
- Create: `ios/WorkInCafe/Features/Review/ReviewPhotoPicker.swift`
- Create: `ios/WorkInCafeTests/Photos/ReviewImageProcessorTests.swift`
- Create: `ios/WorkInCafeTests/Photos/ReviewPhotoUploadServiceTests.swift`
- Add: deterministic HEIC/JPEG/orientation fixtures under `ios/WorkInCafeTests/Fixtures/Images/`
- Modify: `ios/WorkInCafe/Core/API/AuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/Core/API/LiveAuthenticatedConsumerAPI.swift`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`

**Interfaces:**
- Produces: processed JPEG with size/checksum, per-file upload state, camera/photo-library entry, and `ReviewPhotoAPI`.
- Consumes: `/api/v1/config`, signed photo preparation/completion endpoints, PhotosUI, and AVCapturePhotoOutput.

- [ ] **Step 1: Write failing orientation/metadata tests**

```swift
@Test("normalizes orientation and strips metadata")
func normalize() async throws {
    let output = try await ReviewImageProcessor().process(fixture: .rotatedHEIC)
    #expect(output.pixelSize.width <= 2048)
    #expect(output.pixelSize.height <= 2048)
    #expect(output.metadata.keys.isDisjoint(with: ["{GPS}", "{Exif}", "{TIFF}"]))
    #expect(output.sha256.count == 64)
}
```

- [ ] **Step 2: Verify photo modules are missing**

Run: `scripts/ios-test --only WorkInCafeTests/Photos`

Expected: FAIL on missing `ReviewImageProcessor`.

- [ ] **Step 3: Implement off-main bounded processing**

Downsample with ImageIO to a 2048-pixel maximum edge, normalize orientation into pixels, emit sRGB JPEG at 0.82 quality, strip GPS/EXIF/TIFF, cap output at 8 MB, compute SHA-256, and operate outside `@MainActor`.

- [ ] **Step 4: Implement gate-first picker/camera/upload state**

Fetch fail-closed config before showing photo controls. `PhotosPicker` handles library; `CameraCaptureController` owns an `AVCaptureSession` only while camera is visible. Upload states are `.selected`, `.processing`, `.preparing`, `.uploading(progress)`, `.completing`, `.complete`, and `.failed(retryable:)`; retry one file without restarting successful files.

Extend `LiveAuthenticatedConsumerAPI` with:

```swift
protocol ReviewPhotoAPI: Sendable {
    func publicReviewPhotosEnabled() async throws -> Bool
    func preparePhoto(reviewID: UUID, photo: ProcessedReviewPhoto, slot: Int) async throws -> PreparedPhotoUpload
    func completePhoto(reviewID: UUID, prepared: PreparedPhotoUpload) async throws
}

struct PreparedPhotoUpload: Sendable, Equatable {
    let uploadURL: URL
    let publicID: String
    let signature: String
    let expiresAt: Date
}
```

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Photos`

Expected: disabled/error gate, HEIC/JPEG/orientation/metadata/size, ownership denial, cancellation, progress, per-file retry, and idempotent completion tests PASS.

```bash
git add ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Photos ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafe/Features/Review/ReviewPhotoPicker.swift ios/WorkInCafe/App ios/WorkInCafeTests/Photos ios/WorkInCafeTests/Fixtures/Images
git commit -m "feat: add gated native review photos" -m "— gib"
```

### Task 8: Add authenticated/device end-to-end coverage

**Files:**
- Create: `ios/WorkInCafeUITests/AuthenticatedFlowsTests.swift`
- Create: `ios/WorkInCafeUITests/DevicePermissionTests.swift`
- Create: `ios/WorkInCafeUITests/InterruptionRecoveryTests.swift`
- Create: `docs/release/native-device-flows.md`
- Modify: `ios/WorkInCafe/App/AppEnvironment.swift`
- Modify: `ios/WorkInCafe/Core/Support/UIFixtureServices.swift`
- Modify: `design/ios-companion/screens/`

**Interfaces:**
- Produces: deterministic launch-argument adapters for auth, location, network, audio, camera, and photo fixtures.
- Consumes: real physical devices for microphone/camera/interruption acceptance.

- [ ] **Step 1: Complete deterministic UI dependency injection**

```swift
struct AppEnvironment {
    let consumerAPI: any ConsumerAPI
    let authenticatedAPI: any FavoritesAPI & ContributionAPI & WiFiSampleAPI & NoiseSampleAPI & ReviewPhotoAPI
    let placeCache: any PlaceCaching
    let draftStore: DraftStore
    let sessionStore: SessionStore
    let linkRouter: any UniversalLinkRouting
    let location: any LocationProviding
    let wifi: any WiFiMeasuring
    let noise: any NoiseMeasuring
    let photos: any ReviewPhotoProviding
}
```

Tasks 1 and 3–7 grow this composition root as each capability lands. Feature stores receive only their narrow protocol, not the whole environment. Production builds always use `.live()`; fixture services compile only into Debug/UI-test configuration, and `WorkInCafeApp` rejects `-ui-testing` in Release.

- [ ] **Step 2: Write complete user journeys**

Cover guest favorite → sign in → return; recovered review → submit → fresh location; denied/approximate/revoked location; Wi-Fi cancellation; microphone interruption; photo disabled/enabled/retry; offline/lossy network; app termination during OAuth return.

- [ ] **Step 3: Run simulator and physical-device gates**

Run: `swift test --package-path ios/Packages/WorkInCafeCore && scripts/ios-test`

Expected: all automated tests PASS. On physical iPhones, confirm camera formats, microphone interruption, real permission transitions, background/foreground, and no continuing location/audio indicator after dismissal.

- [ ] **Step 4: Update companion and commit evidence**

Reopen the companion after each visual revision; preserve the prior screens and resolve/link notes. Record only redacted test accounts and synthetic fixtures in `docs/release/native-device-flows.md`.

```bash
git add ios/WorkInCafe/App/AppEnvironment.swift ios/WorkInCafe/Core/Support/UIFixtureServices.swift ios/WorkInCafeUITests docs/release/native-device-flows.md design/ios-companion/screens
git commit -m "test: verify native device flows" -m "— gib"
```

## Milestone completion gate

- Run `scripts/ios-generate --check`, `swift test --package-path ios/Packages/WorkInCafeCore`, and `scripts/ios-test` with zero failures.
- Attach physical-device permission/interruption evidence and prove raw audio, exact user coordinates, and tokens are absent from persistence and diagnostics.
- Keep public photos disabled until issue #304 independently proves moderation/reporting/blocking/deletion.
- Open the PR with `Closes #303`, the permission/network/device matrix, privacy evidence, and rollback/feature-gate notes; self-review the GitHub diff before merge.
