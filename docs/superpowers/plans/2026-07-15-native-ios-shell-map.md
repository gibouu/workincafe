# Native iOS Shell and MapKit Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully native SwiftUI iPhone shell with immediate cached launch, high-density MapKit discovery, native search/place details, and Apple Maps directions.

**Architecture:** The Xcode app consumes the generated `WorkInCafeCore` Swift package from issue #301. SwiftUI owns navigation and presentation; an `MKMapView` wrapped with `UIViewRepresentable` owns dense annotations, reuse, clustering, camera-idle loading, and accessibility. Feature models are focused `@Observable @MainActor` types; API, caching, decoding, and reconciliation remain actor-isolated and independently testable.

**Tech Stack:** Xcode 26.5, Swift 6.3.2 language mode, iOS 18.0 minimum, SwiftUI, Observation, MapKit, URLSession, Swift OpenAPI Generator 1.13.0, XCTest, XCUITest, OSLog, MetricKit, XcodeGen 2.45.3.

## Global Constraints

- Tracking issue: [#302](https://github.com/gibouu/workincafe/issues/302); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- Hard dependency: issue #301 must provide the frozen read contract, generated Swift client, bearer token provider, and universal-link core.
- Bundle identifier is `cafe.workin.app`; iOS deployment target is 18.0; targeted device family is iPhone only.
- SwiftUI is the presentation layer; dense-map implementation is `MKMapView` through `UIViewRepresentable`, not a web view or cross-platform layer.
- No networking, decoding, image processing, disk I/O, or annotation diffing executes on the main actor.
- Cached map usable target: 1.5 seconds cold; warm interaction target: 750 ms; cached annotation feedback target: 100 ms.
- Native visual behavior in Simulator/physical iPhones is authoritative; the localhost companion is the annotation/comparison surface.
- Every commit and PR body ends with `— gib` and contains no AI trailer.

---

## File map

- Project/build: `ios/project.yml`, `ios/Config/`, `ios/WorkInCafe.xcodeproj/`, `scripts/ios-generate`, `scripts/ios-test`.
- App shell: `ios/WorkInCafe/App/`, `ios/WorkInCafe/Core/DesignSystem/`, `ios/WorkInCafe/Core/Support/`.
- Data/cache: `ios/WorkInCafe/Core/API/`, `ios/WorkInCafe/Core/Cache/`, `ios/WorkInCafe/Core/Models/`.
- Features: `ios/WorkInCafe/Features/{Map,Search,Place}/`.
- Tests: `ios/WorkInCafeTests/`, `ios/WorkInCafeUITests/`.
- Visual companion: `design/ios-companion/`.

### Task 1: Generate a reproducible native project and smoke-tested app shell

**Files:**
- Create: `ios/project.yml`
- Create: `ios/Config/Base.xcconfig`
- Create: `ios/Config/Debug.xcconfig`
- Create: `ios/Config/Release.xcconfig`
- Create: `ios/WorkInCafe/Info.plist`
- Create: `ios/WorkInCafe/App/WorkInCafeApp.swift`
- Create: `ios/WorkInCafe/App/AppRootView.swift`
- Create: `ios/WorkInCafeTests/AppRootTests.swift`
- Create: `ios/WorkInCafeUITests/LaunchTests.swift`
- Create: `ios/WorkInCafeTests/Support/Fixtures.swift`
- Create: `ios/WorkInCafeTests/Support/Mocks.swift`
- Create: `scripts/ios-generate`
- Create: `scripts/ios-test`
- Generate: `ios/WorkInCafe.xcodeproj/`

**Interfaces:**
- Produces: shared `WorkInCafe` scheme with app, unit-test, and UI-test targets.
- Consumes: local package `ios/Packages/WorkInCafeCore` from issue #301.

- [ ] **Step 1: Write the failing shell unit test**

```swift
import Testing
@testable import WorkInCafe

@Suite("App root")
struct AppRootTests {
    @Test("starts in guest discovery")
    func guestDiscovery() {
        let state = AppRootState(session: nil)
        #expect(state.destination == .discovery)
    }

    @Test("routes cold-launch place and recovery links")
    func universalLinks() {
        var state = AppRootState(session: nil)
        let placeID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!
        state.route(.place(placeID))
        #expect(state.destination == .place(placeID))
        state.route(.recover(kind: .review, placeID: placeID))
        #expect(state.destination == .review(placeID))
    }
}
```

- [ ] **Step 2: Run generation/test and verify the missing-project failure**

Run: `xcodegen generate --spec ios/project.yml && xcodebuild test -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest'`

Expected: FAIL because `ios/project.yml` does not exist.

- [ ] **Step 3: Define the XcodeGen project**

```yaml
name: WorkInCafe
options:
  minimumXcodeGenVersion: 2.45.3
  deploymentTarget:
    iOS: "18.0"
packages:
  WorkInCafeCore:
    path: Packages/WorkInCafeCore
settings:
  base:
    SWIFT_VERSION: "6.0"
    SWIFT_STRICT_CONCURRENCY: complete
    TARGETED_DEVICE_FAMILY: "1"
    PRODUCT_BUNDLE_IDENTIFIER: cafe.workin.app
targets:
  WorkInCafe:
    type: application
    platform: iOS
    sources: [WorkInCafe]
    configFiles:
      Debug: Config/Debug.xcconfig
      Release: Config/Release.xcconfig
    info:
      path: WorkInCafe/Info.plist
    dependencies:
      - package: WorkInCafeCore
  WorkInCafeTests:
    type: bundle.unit-test
    platform: iOS
    sources: [WorkInCafeTests]
    dependencies: [{ target: WorkInCafe }]
  WorkInCafeUITests:
    type: bundle.ui-testing
    platform: iOS
    sources: [WorkInCafeUITests]
    dependencies: [{ target: WorkInCafe }]
schemes:
  WorkInCafe:
    build:
      targets:
        WorkInCafe: all
    test:
      targets: [WorkInCafeTests, WorkInCafeUITests]
```

`scripts/ios-generate` runs `xcodegen generate --spec ios/project.yml`; with `--check` it regenerates and then runs `git diff --exit-code -- ios/WorkInCafe.xcodeproj`. `scripts/ios-test` accepts any number of `--only Target/Suite` arguments and translates each to `-only-testing:Target/Suite`; `--ui-only Target/Suite` selects only that UI test. It defaults to `platform=iOS Simulator,name=iPhone 17 Pro,OS=latest`, writes result bundles below ignored `.artifacts/ios-tests/`, and otherwise runs the complete shared scheme.

- [ ] **Step 4: Implement the minimal guest shell**

```swift
import SwiftUI

@main
struct WorkInCafeApp: App {
    var body: some Scene {
        WindowGroup { AppRootView() }
    }
}

enum AppDestination: Equatable {
    case discovery
    case place(UUID)
    case review(UUID)
    case checkIn(UUID)
    case liveUpdate(UUID)
    case authenticationReturn
}

struct AppRootState: Equatable {
    private(set) var destination: AppDestination
    init(session: NativeSession?) { destination = .discovery }

    mutating func route(_ link: AppLink) {
        switch link {
        case .place(let id): destination = .place(id)
        case .recover(.review, let id): destination = .review(id)
        case .recover(.checkIn, let id): destination = .checkIn(id)
        case .recover(.liveUpdate, let id): destination = .liveUpdate(id)
        case .authCallback: destination = .authenticationReturn
        }
    }
}

struct AppRootView: View {
    var body: some View {
        NavigationStack { Text("Work in Cafe").accessibilityIdentifier("app.discovery.root") }
    }
}
```

`WorkInCafeApp` owns one `AppRootState` for the process lifetime. Scene URL handling calls `UniversalLinkRouter.route(_:)`, then `AppRootState.route(_:)`; issue #303 replaces the temporary `.authenticationReturn` screen with session exchange and restoration of the pending place/review/check-in/live-update destination. URL query values are never stored in navigation state.

- [ ] **Step 5: Generate, test, and commit**

Run: `xcodegen generate --spec ios/project.yml && xcodebuild test -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=latest'`

Expected: project generation succeeds and app/unit/UI smoke tests PASS.

```bash
git add ios scripts/ios-generate scripts/ios-test
git commit -m "feat: scaffold native iPhone app" -m "— gib"
```

### Task 2: Add the native design system and visual annotation companion

**Files:**
- Create: `ios/WorkInCafe/Core/DesignSystem/WICColors.swift`
- Create: `ios/WorkInCafe/Core/DesignSystem/WICTypography.swift`
- Create: `ios/WorkInCafe/Core/DesignSystem/WICSpacing.swift`
- Create: `ios/WorkInCafe/Core/DesignSystem/WICButtonStyle.swift`
- Create: `ios/WorkInCafeTests/DesignSystemTests.swift`
- Create: `design/ios-companion/index.html`
- Create: `design/ios-companion/styles.css`
- Create: `design/ios-companion/app.js`
- Create: `design/ios-companion/screens/001-map-shell.json`
- Create: `scripts/ios-companion`

**Interfaces:**
- Produces: semantic native color/spacing/type tokens and stable companion screen/element IDs.
- Consumes: current Work in Cafe brand palette while using system fonts, materials, Dynamic Type, and native contrast behavior.

- [ ] **Step 1: Write the failing touch-target token test**

```swift
import Testing
@testable import WorkInCafe

@Test("minimum control target is 44 points")
func minimumTarget() {
    #expect(WICSpacing.minimumControlTarget == 44)
}
```

- [ ] **Step 2: Verify the design token is missing**

Run: `scripts/ios-test --only WorkInCafeTests/DesignSystemTests`

Expected: FAIL because `WICSpacing` does not exist.

- [ ] **Step 3: Implement semantic native tokens**

```swift
enum WICSpacing {
    static let xSmall: CGFloat = 4
    static let small: CGFloat = 8
    static let medium: CGFloat = 16
    static let large: CGFloat = 24
    static let minimumControlTarget: CGFloat = 44
}

extension Color {
    static let wicAccent = Color("AccentColor")
    static let wicMapPin = Color("MapPinColor")
}
```

Use semantic asset colors with light/dark/high-contrast variants; do not hard-code text sizes or replace system navigation/sheet behavior.

- [ ] **Step 4: Implement immediate right-click companion notes**

```js
document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  const target = event.target.closest('[data-element-id]');
  const note = window.prompt('Note for this position');
  if (!note) return;
  const record = {
    screenId: document.body.dataset.screenId,
    route: location.pathname,
    elementId: target?.dataset.elementId ?? 'screen',
    x: event.pageX / document.documentElement.scrollWidth,
    y: event.pageY / document.documentElement.scrollHeight,
    note,
    createdAt: new Date().toISOString(),
  };
  const notes = JSON.parse(localStorage.getItem('wic-ios-notes-v1') ?? '[]');
  notes.push(record);
  localStorage.setItem('wic-ios-notes-v1', JSON.stringify(notes));
  renderNotes(notes);
});
```

The screen registry preserves every revision rather than overwriting it. `scripts/ios-companion` serves this directory at `http://127.0.0.1:4173`.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/DesignSystemTests && scripts/ios-companion --check`

Expected: token tests PASS and companion check confirms stable screen/element IDs plus persisted note schema.

```bash
git add ios/WorkInCafe/Core/DesignSystem ios/WorkInCafeTests/DesignSystemTests.swift design/ios-companion scripts/ios-companion
git commit -m "feat: add native design review system" -m "— gib"
```

### Task 3: Add actor-isolated API transport and bounded disk cache

**Files:**
- Create: `ios/WorkInCafe/Core/API/ConsumerAPI.swift`
- Create: `ios/WorkInCafe/Core/API/LiveConsumerAPI.swift`
- Create: `ios/WorkInCafe/Core/API/APIError.swift`
- Create: `ios/WorkInCafe/Core/Models/ConsumerModels.swift`
- Create: `ios/WorkInCafe/Core/Cache/PlaceCache.swift`
- Create: `ios/WorkInCafe/Core/Cache/CacheEnvelope.swift`
- Create: `ios/WorkInCafeTests/API/ConsumerAPITests.swift`
- Create: `ios/WorkInCafeTests/Cache/PlaceCacheTests.swift`

**Interfaces:**
- Produces: `ConsumerAPI`, `LiveConsumerAPI`, `PlaceCaching`, `PlaceCache`, and typed `APIError`.
- Consumes: generated `Client`, `BearerTokenProviding`, and v1 models from `WorkInCafeCore`.

- [ ] **Step 1: Write failing cancellation and cache-expiry tests**

```swift
@Test("cancelled viewport request does not publish")
func cancellation() async throws {
    let transport = SuspendedTransport()
    let api = LiveConsumerAPI(client: transport.client)
    let task = Task { try await api.places(in: .paris) }
    task.cancel()
    await #expect(throws: CancellationError.self) { try await task.value }
}

@Test("expired cache entry is removed")
func expiry() async throws {
    let clock = TestClock(now: .init(timeIntervalSince1970: 1_000))
    let cache = PlaceCache(directory: temporaryDirectory(), clock: clock, byteLimit: 25_000_000)
    try await cache.store(.parisFixture, for: "place:a", ttl: 30)
    clock.advance(by: 31)
    #expect(try await cache.value(PlaceDetail.self, for: "place:a") == nil)
}
```

- [ ] **Step 2: Verify API/cache types are missing**

Run: `scripts/ios-test --only WorkInCafeTests/API --only WorkInCafeTests/Cache`

Expected: FAIL on missing `LiveConsumerAPI` or `PlaceCache`.

- [ ] **Step 3: Define a testable API boundary**

```swift
public protocol ConsumerAPI: Sendable {
    func places(in cell: MapViewportCell) async throws -> [PlaceSummary]
    func place(id: UUID) async throws -> PlaceDetail
    func reviews(placeID: UUID, cursor: String?) async throws -> Page<Review>
    func menus(placeID: UUID) async throws -> [PlaceMenu]
    func searchPlaces(query: String, near: Coordinate?) async throws -> [PlaceSummary]
}

public struct Coordinate: Hashable, Codable, Sendable {
    public let latitude: Double
    public let longitude: Double
}

public struct CoordinateBounds: Hashable, Codable, Sendable {
    public let southWest: Coordinate
    public let northEast: Coordinate
}

public struct PlaceSummary: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public let name: String
    public let category: String
    public let coordinate: Coordinate
    public let rating: Double?
}

public struct PlaceDetail: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public let name: String
    public let category: String
    public let coordinate: Coordinate
    public let address: String
    public let rating: Double?
}

public struct Review: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public let placeID: UUID
    public let overallRating: Int
    public let comment: String?
    public let createdAt: Date
}

public struct PlaceMenu: Identifiable, Hashable, Codable, Sendable {
    public let id: UUID
    public let title: String
    public let items: [String]
}

public struct Page<Element: Hashable & Codable & Sendable>: Hashable, Codable, Sendable {
    public let items: [Element]
    public let nextCursor: String?
}
```

Map generated OpenAPI schemas into these app-owned domain models at the transport boundary. Map generated response cases into `APIError.offline`, `.timeout`, `.unauthorized`, `.forbidden`, `.rateLimited(retryAfter:)`, `.validation`, `.geoVerification`, `.serviceUnavailable`, `.contractMismatch`, or `.server`.

- [ ] **Step 4: Implement bounded atomic cache storage**

```swift
struct CacheEnvelope<Value: Codable & Sendable>: Codable, Sendable {
    let schemaVersion: Int
    let storedAt: Date
    let expiresAt: Date
    let value: Value
}

actor PlaceCache {
    static let schemaVersion = 1
    // Atomic temporary-file replacement; remove expired entries first,
    // then oldest entries until total bytes are <= byteLimit.
}

protocol PlaceCaching: Sendable {
    func value<Value: Decodable & Sendable>(_ type: Value.Type, for key: String) async throws -> Value?
    func store<Value: Encodable & Sendable>(_ value: Value, for key: String, ttl: TimeInterval) async throws
    func removeValue(for key: String) async throws
}
```

`PlaceCache` implements `PlaceCaching`; tests and UI fixtures use an in-memory implementation of the same protocol. Store rounded camera/filter separately from place data. Cache non-sensitive summaries/details only; never cache tokens or exact user coordinates.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/API --only WorkInCafeTests/Cache`

Expected: cancellation, 401 refresh boundary, corrupt-file eviction, schema mismatch, expiry, and 25 MB eviction tests PASS.

```bash
git add ios/WorkInCafe/Core/API ios/WorkInCafe/Core/Models ios/WorkInCafe/Core/Cache ios/WorkInCafeTests/API ios/WorkInCafeTests/Cache
git commit -m "feat: add native API and cache core" -m "— gib"
```

### Task 4: Add viewport quantization and stable annotation reconciliation

**Files:**
- Create: `ios/WorkInCafe/Features/Map/MapViewportCell.swift`
- Create: `ios/WorkInCafe/Features/Map/PlaceAnnotation.swift`
- Create: `ios/WorkInCafe/Features/Map/AnnotationDiff.swift`
- Create: `ios/WorkInCafeTests/Map/MapViewportCellTests.swift`
- Create: `ios/WorkInCafeTests/Map/AnnotationDiffTests.swift`

**Interfaces:**
- Produces: `MapViewportCell`, `PlaceAnnotation`, and `AnnotationDiff.calculate(existing:incoming:)`.
- Consumes: stable place IDs and summary coordinates only.

- [ ] **Step 1: Write failing quantization and identity tests**

```swift
@Test("camera jitter maps to one cell")
func cameraJitter() {
    let first = MapViewportCell(region: .paris.offset(latitude: 0.00001))
    let second = MapViewportCell(region: .paris.offset(latitude: 0.00004))
    #expect(first.key == second.key)
}

@Test("moving an annotation updates instead of replacing")
func stableIdentity() {
    let placeID = UUID(uuidString: "00000000-0000-0000-0000-00000000000a")!
    let existing = [PlaceAnnotation.fixture(id: placeID, latitude: 48.8)]
    let incoming = [PlaceSummary.fixture(id: placeID, latitude: 48.81)]
    let diff = AnnotationDiff.calculate(existing: existing, incoming: incoming)
    #expect(diff.remove.isEmpty)
    #expect(diff.add.isEmpty)
    #expect(diff.update.map(\.id) == [placeID])
}
```

- [ ] **Step 2: Verify missing map primitives fail**

Run: `scripts/ios-test --only WorkInCafeTests/Map/MapViewportCellTests --only WorkInCafeTests/Map/AnnotationDiffTests`

Expected: FAIL on missing types.

- [ ] **Step 3: Implement rounded cells and mutable annotation coordinates**

```swift
struct MapViewportCell: Hashable, Codable, Sendable {
    let key: String
    let bounds: CoordinateBounds

    init(region: MKCoordinateRegion) {
        let step = 0.001
        func rounded(_ value: Double) -> Double { (value / step).rounded() * step }
        let bounds = CoordinateBounds(region: region).rounded(using: rounded)
        self.bounds = bounds
        self.key = bounds.cacheKey
    }
}

final class PlaceAnnotation: NSObject, MKAnnotation {
    let id: UUID
    @objc dynamic var coordinate: CLLocationCoordinate2D
    var presentationKey: String
    var accessibilityName: String
}
```

- [ ] **Step 4: Keep the diff pure and off-main**

`AnnotationDiff` returns added summaries, removed IDs, and coordinate/presentation updates. It never touches `MKMapView`; coordinator application happens on `@MainActor`.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Map`

Expected: quantization, add/update/remove, duplicate-ID rejection, and presentation-change tests PASS.

```bash
git add ios/WorkInCafe/Features/Map ios/WorkInCafeTests/Map
git commit -m "feat: add native map reconciliation core" -m "— gib"
```

### Task 5: Implement the reusable, clustered `MKMapView`

**Files:**
- Create: `ios/WorkInCafe/Features/Map/MapViewRepresentable.swift`
- Create: `ios/WorkInCafe/Features/Map/MapCoordinator.swift`
- Create: `ios/WorkInCafe/Features/Map/PlaceAnnotationView.swift`
- Create: `ios/WorkInCafe/Features/Map/ClusterAnnotationView.swift`
- Create: `ios/WorkInCafe/Features/Map/MapFeatureModel.swift`
- Create: `ios/WorkInCafe/Features/Map/MapScreen.swift`
- Create: `ios/WorkInCafeTests/Map/MapFeatureModelTests.swift`
- Create: `ios/WorkInCafeUITests/MapDiscoveryTests.swift`

**Interfaces:**
- Produces: `MapFeatureModel.load(cell:)`, selection binding, camera-idle callback, and reusable place/cluster views.
- Consumes: `ConsumerAPI`, `PlaceCache`, and `AnnotationDiff`.

- [ ] **Step 1: Write the failing cancellation/cache-first model test**

```swift
@Test("new camera cell cancels the old request and keeps cached summaries visible")
@MainActor
func cameraCancellation() async {
    let api = ControlledConsumerAPI()
    let cache = InMemoryPlaceCache(values: [.paris: [.cachedParis]])
    let model = MapFeatureModel(api: api, cache: cache)
    model.load(cell: .paris)
    await api.waitUntilRequested(.paris)
    #expect(model.places == [.cachedParis])
    model.load(cell: .toronto)
    await api.waitUntilCancelled(.paris)
    let cancelledCells = await api.cancelledCells
    #expect(cancelledCells == [.paris])
}
```

- [ ] **Step 2: Verify the feature model is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Map/MapFeatureModelTests`

Expected: FAIL on missing `MapFeatureModel`.

- [ ] **Step 3: Implement cache-first, request-cancelling state**

```swift
@Observable @MainActor
final class MapFeatureModel {
    private(set) var places: [PlaceSummary] = []
    var selectedPlaceID: UUID?
    var error: APIError?
    private var loadTask: Task<Void, Never>?

    func load(cell: MapViewportCell) {
        guard cell.key != currentCell?.key else { return }
        loadTask?.cancel()
        currentCell = cell
        loadTask = Task { await loadCacheThenNetwork(cell) }
    }
}
```

- [ ] **Step 4: Implement MapKit reuse, clustering, and accessibility**

Register place/cluster reuse identifiers once. Set `PlaceAnnotationView.clusteringIdentifier = "workincafe.place"`; keep callout data minimal; apply stable diffs rather than remove-all. `mapView(_:regionDidChangeAnimated:)` emits a new cell after camera movement settles. Annotation views expose venue name/category/rating as labels, `.button` trait, and activate selection; clusters expose count and zoom action.

- [ ] **Step 5: Verify map behavior and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Map && scripts/ios-test --ui-only WorkInCafeUITests/MapDiscoveryTests`

Expected: stale requests cancel, same-cell movement makes no request, annotation identity persists, clusters zoom, and VoiceOver activation selects a place.

```bash
git add ios/WorkInCafe/Features/Map ios/WorkInCafeTests/Map ios/WorkInCafeUITests/MapDiscoveryTests.swift
git commit -m "feat: build clustered native map" -m "— gib"
```

### Task 6: Add native search, place details, and Apple Maps directions

**Files:**
- Create: `ios/WorkInCafe/Features/Search/SearchFeatureModel.swift`
- Create: `ios/WorkInCafe/Features/Search/SearchSheet.swift`
- Create: `ios/WorkInCafe/Features/Place/PlaceDetailModel.swift`
- Create: `ios/WorkInCafe/Features/Place/PlaceSheet.swift`
- Create: `ios/WorkInCafe/Features/Place/DirectionsOpening.swift`
- Create: `ios/WorkInCafeTests/Search/SearchFeatureModelTests.swift`
- Create: `ios/WorkInCafeTests/Place/PlaceDetailModelTests.swift`
- Create: `ios/WorkInCafeUITests/PlaceDiscoveryFlowTests.swift`

**Interfaces:**
- Produces: debounced/cancellable search, concurrent detail/review/menu load, and `DirectionsOpening.open(place:)`.
- Consumes: selected cached summary immediately, then `ConsumerAPI` resources keyed by place ID.

- [ ] **Step 1: Write failing no-cross-place-flash test**

```swift
@Test("selecting B never exposes A resources")
@MainActor
func selectionIsolation() async {
    let api = ControlledConsumerAPI()
    let model = PlaceDetailModel(api: api, cache: InMemoryPlaceCache())
    model.select(.placeA)
    model.select(.placeB)
    api.completeDetails(for: .placeA)
    #expect(model.summary.id == .placeB)
    #expect(model.details?.id != .placeA)
    #expect(model.reviews.allSatisfy { $0.placeID == .placeB })
}
```

- [ ] **Step 2: Verify missing detail/search models fail**

Run: `scripts/ios-test --only WorkInCafeTests/Search --only WorkInCafeTests/Place`

Expected: FAIL on missing feature models.

- [ ] **Step 3: Implement concurrent keyed resources**

On selection, present cached summary immediately, cancel the prior selection task, and use `async let` for details, reviews, and menus. Publish each result only if `selectedPlaceID` still matches. Search debounces 250 ms, cancels prior work, and biases to current map center without persisting exact user location.

- [ ] **Step 4: Implement native presentation and directions**

Use SwiftUI sheet detents, `.searchable`, redacted loading skeletons, retry buttons, stale/offline badges, Dynamic Type, and system materials. Directions constructs `MKPlacemark`/`MKMapItem`, sets name, and calls `openInMaps(launchOptions: [MKLaunchOptionsDirectionsModeKey: MKLaunchOptionsDirectionsModeWalking])`.

- [ ] **Step 5: Verify and commit**

Run: `scripts/ios-test --only WorkInCafeTests/Search --only WorkInCafeTests/Place && scripts/ios-test --ui-only WorkInCafeUITests/PlaceDiscoveryFlowTests`

Expected: debouncing/cancellation, resource isolation, cached-first sheet, offline retry, search selection, and Apple Maps handoff tests PASS.

```bash
git add ios/WorkInCafe/Features/Search ios/WorkInCafe/Features/Place ios/WorkInCafeTests/Search ios/WorkInCafeTests/Place ios/WorkInCafeUITests/PlaceDiscoveryFlowTests.swift
git commit -m "feat: add native place discovery flow" -m "— gib"
```

### Task 7: Enforce native launch, interaction, memory, and accessibility budgets

**Files:**
- Create: `ios/WorkInCafe/Core/Support/PerformanceSignposts.swift`
- Create: `ios/WorkInCafe/Core/Support/AccessibilityIdentifiers.swift`
- Create: `ios/WorkInCafeTests/Performance/MapPerformanceTests.swift`
- Create: `ios/WorkInCafeUITests/LaunchPerformanceTests.swift`
- Create: `ios/WorkInCafeUITests/AccessibilityTests.swift`
- Create: `docs/release/native-map-performance.md`
- Modify: `design/ios-companion/screens/`

**Interfaces:**
- Produces: stable signpost names `launchToCachedMap`, `cameraCellLoad`, `annotationReconcile`, and `placeSelectionFeedback`.
- Consumes: XCTest metrics, Instruments, MetricKit, and physical-device evidence.

- [ ] **Step 1: Write launch and selection metric tests**

```swift
func testWarmLaunchMetric() throws {
    measure(metrics: [XCTApplicationLaunchMetric(waitUntilResponsive: true)]) {
        let app = XCUIApplication()
        app.launchArguments = ["-fixture", "cached-paris"]
        app.launch()
        XCTAssertTrue(app.otherElements["map.root"].waitForExistence(timeout: 0.75))
    }
}

func testCachedSelectionFeedback() {
    measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
        app.buttons["map.place.paris-001"].tap()
        XCTAssertTrue(app.otherElements["place.sheet"].waitForExistence(timeout: 0.1))
        app.buttons["place.close"].tap()
    }
}
```

- [ ] **Step 2: Run and record the initial metric failure/baseline**

Run: `scripts/ios-test --ui-only WorkInCafeUITests/LaunchPerformanceTests`

Expected: metric test initially fails its target or has no baseline; attach raw result bundle to the issue.

- [ ] **Step 3: Add signposts and eliminate measured main-thread work**

Wrap the four lifecycle phases with `OSSignposter`; profile SwiftUI updates, Time Profiler, allocations, networking, energy, and animation hitches. Move any measured decoding, diff, file, or formatting work off `@MainActor` and retain only UI application on main.

- [ ] **Step 4: Complete accessibility and 10-minute stability evidence**

Run VoiceOver labels/actions, Dynamic Type through accessibility sizes, Increase Contrast, Reduce Motion, and Voice Control. Record a 10-minute pan/select/dismiss trace at representative city density; verify no recurring hitch above 100 ms and memory trends back toward baseline after dismissal/memory warning.

- [ ] **Step 5: Run the milestone gate and commit**

Run: `scripts/ios-generate --check && swift test --package-path ios/Packages/WorkInCafeCore && scripts/ios-test`

Expected: all Swift/unit/UI tests PASS and the physical-device evidence meets the approved budgets.

```bash
git add ios docs/release/native-map-performance.md design/ios-companion/screens
git commit -m "test: enforce native map performance" -m "— gib"
```

## Milestone completion gate

- Run `xcodegen generate --spec ios/project.yml` and prove `git diff --exit-code -- ios/WorkInCafe.xcodeproj`.
- Run `swift test --package-path ios/Packages/WorkInCafeCore` and `scripts/ios-test` with zero failures.
- Attach XCTest result bundles, Instruments traces, Simulator recordings, physical iPhone evidence, and resolved companion annotations.
- Open the PR with `Closes #302`, the supported device/OS matrix, measured budgets, and rollback notes; self-review the GitHub diff before merge.
