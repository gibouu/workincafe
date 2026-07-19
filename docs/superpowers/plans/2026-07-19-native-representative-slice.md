# Native WorkinCafe Representative Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic native MVP presentation with the approved WorkinCafe discovery slice: branded map markers and clusters, synchronized map/list discovery, selected-place preview, full place details, search, and filters.

**Architecture:** Preserve the existing Swift 6, XcodeGen, actor-backed API/cache, `MKMapView`, clustering, and reconciliation foundation. Add a small composition root and focused discovery state, then render the approved slice with native SwiftUI navigation and sheets; current public reads and deterministic fixtures supply honest data while authenticated/write contracts remain a later plan.

**Tech Stack:** Swift 6, SwiftUI, MapKit, CoreLocation, Observation/Combine where already established, Swift Testing, XCTest UI testing, XcodeGen, HTML/CSS/JavaScript visual companion.

## Global Constraints

- Deployment target remains iOS 18.0 and `TARGETED_DEVICE_FAMILY` remains iPhone (`1`).
- Use SwiftUI for product presentation and `MKMapView` through `UIViewRepresentable` for dense discovery.
- Use only Apple frameworks; add no third-party runtime dependency.
- The live web product is the brand, terminology, content-density, and information-hierarchy reference.
- Do not copy web interaction mechanics when native navigation, sheets, gestures, safe areas, Dynamic Type, haptics, accessibility, or platform controls are stronger.
- Do not preserve any MVP visual element solely because it exists.
- Never invent unsupported vitals, open state, distance, counts, or backend success.
- The map is never the only discovery path.
- All controls have a minimum 44-point hit target, work with Dynamic Type, expose VoiceOver state, and do not communicate selection by color alone.
- Routine animation is limited to map camera changes, sheet presentation, selection, and state changes; Reduce Motion disables marker scaling.
- No archive may be exported, uploaded, or submitted until explicit Simulator approval and the full release gates in the approved design spec pass.
- Commits and PR descriptions end with `— gib` on its own line and contain no AI co-author footer.

## File Map

### App composition and routing

- Create `ios/WorkInCafe/App/AppEnvironment.swift`: constructs live or fixture dependencies once.
- Replace `ios/WorkInCafe/App/AppRootState.swift`: defines `ProductMode`, `AppRoute`, `AppSheet`, and `AppRouter`.
- Replace `ios/WorkInCafe/App/AppRootView.swift`: owns the router, discovery model, per-mode navigation, and product dock.
- Create `ios/WorkInCafe/App/RootProductDock.swift`: accessible Profile / Work spots / Cowork mode switcher.

### Design and domain presentation

- Replace `ios/WorkInCafe/Core/DesignSystem/WICDesign.swift`: semantic spacing, radii, colors, shadows, and material surfaces.
- Create `ios/WorkInCafe/Core/DesignSystem/PlacePresentation.swift`: canonical category/brand colors, symbols, monograms, and accessible foregrounds.
- Modify `ios/WorkInCafe/Core/Models/PlaceSummary.swift`: delegates presentation metadata and exposes honest display helpers.

### Discovery

- Create `ios/WorkInCafe/Features/Discovery/DiscoveryMode.swift`: map/list mode.
- Create `ios/WorkInCafe/Features/Discovery/DiscoveryFilter.swift`: supported category and rating filters with serialization-free local evaluation.
- Create `ios/WorkInCafe/Features/Discovery/DiscoveryStore.swift`: query, filters, mode, selected ID, visible results, and selection intent.
- Create `ios/WorkInCafe/Features/Discovery/DiscoveryScreen.swift`: approved map-first shell and native overlays.
- Create `ios/WorkInCafe/Features/Discovery/DiscoverySearchView.swift`: full-height native search.
- Create `ios/WorkInCafe/Features/Discovery/DiscoveryFilterView.swift`: native filter sheet.
- Create `ios/WorkInCafe/Features/Discovery/DiscoveryListView.swift`: non-map discovery alternative.
- Create `ios/WorkInCafe/Features/Discovery/PlaceResultRow.swift`: dense reusable place result row.

### Map

- Modify `ios/WorkInCafe/Features/Map/MapAnnotations.swift`: minimal annotation payload and custom circular marker/cluster views.
- Modify `ios/WorkInCafe/Features/Map/AnnotationReconciler.swift`: non-trapping deterministic ID handling.
- Modify `ios/WorkInCafe/Features/Map/MapViewRepresentable.swift`: selected marker persistence, camera intent, zoom guard, muted configuration, and safe reconciliation.
- Modify `ios/WorkInCafe/Features/Map/MapFeatureModel.swift`: request generations, cancellation preservation, active-search refresh, and supported local filters.
- Delete `ios/WorkInCafe/Features/Map/MapScreen.swift` after `DiscoveryScreen` becomes the root.
- Create `ios/WorkInCafe/Features/Map/MapCameraIntent.swift`: testable camera/selection instructions.

### Place presentation

- Replace `ios/WorkInCafe/Features/Place/PlaceSheet.swift` with focused preview components.
- Create `ios/WorkInCafe/Features/Place/PlacePreviewSheet.swift`: medium/large selected-place preview.
- Create `ios/WorkInCafe/Features/Place/PlaceDetailView.swift`: navigated detail hierarchy using only fields actually available in this slice.
- Create `ios/WorkInCafe/Features/Place/PlaceIdentityBadge.swift`: shared category/brand badge.
- Create `ios/WorkInCafe/Features/Place/WorkRatingView.swift`: consistent 1–10 rating display.
- Delete `ios/WorkInCafe/Features/Search/SearchSheet.swift` after native discovery search replaces it.

### Verification and companion

- Extend `ios/WorkInCafeTests/Support/PlaceFixture.swift`: branded, rated, and category fixtures.
- Add focused tests under `ios/WorkInCafeTests/Core/` for presentation, filters, discovery state, request identity, annotations, and camera limits.
- Replace `ios/WorkInCafeUITests/LaunchTests.swift`: deterministic fixture-mode flows for the approved slice.
- Replace the visual mockup under `design/ios-companion/` while retaining note storage and stable `data-element-id` identifiers.
- Add `design/ios-companion/screens/002-native-representative-slice.json` and preserve `001-map-shell.json` as the before state.

---

### Task 1: Canonical native design and place identity

**Files:**
- Modify: `ios/WorkInCafe/Core/DesignSystem/WICDesign.swift`
- Create: `ios/WorkInCafe/Core/DesignSystem/PlacePresentation.swift`
- Modify: `ios/WorkInCafe/Core/Models/PlaceSummary.swift`
- Create: `ios/WorkInCafe/Features/Place/PlaceIdentityBadge.swift`
- Create: `ios/WorkInCafe/Features/Place/WorkRatingView.swift`
- Modify: `ios/WorkInCafeTests/Support/PlaceFixture.swift`
- Create: `ios/WorkInCafeTests/Core/PlacePresentationTests.swift`

**Interfaces:**
- Consumes: `PlaceSummary.category`, `PlaceSummary.brand`, and `PlaceSummary.name` from the existing public response.
- Produces: `PlacePresentation.resolve(category:brand:name:) -> PlacePresentation`, `PlaceSummary.presentation`, `PlaceIdentityBadge(place:size:)`, and `WorkRatingView(rating:labelStyle:)`.

- [x] **Step 1: Write failing canonical-palette and brand-resolution tests**

```swift
import Testing
@testable import WorkInCafe

@Suite("Place presentation")
struct PlacePresentationTests {
    @Test("all canonical API categories resolve to stable identities")
    func categories() {
        #expect(PlacePresentation.resolve(category: "cafe", brand: nil, name: "Indie").key == "category.cafe")
        #expect(PlacePresentation.resolve(category: "bakery", brand: nil, name: "Bread").symbolName == "birthday.cake.fill")
        #expect(PlacePresentation.resolve(category: "library", brand: nil, name: "Library").hexColor == 0x2C3E50)
        #expect(PlacePresentation.resolve(category: "coworking", brand: nil, name: "Desk").hexColor == 0x16A085)
        #expect(PlacePresentation.resolve(category: "hotel", brand: nil, name: "Hotel").hexColor == 0x8E44AD)
        #expect(PlacePresentation.resolve(category: "restaurant", brand: nil, name: "Food").hexColor == 0xC0392B)
        #expect(PlacePresentation.resolve(category: "fast_food", brand: nil, name: "Fast").hexColor == 0xE67E22)
        #expect(PlacePresentation.resolve(category: "unknown", brand: nil, name: "Other").hexColor == 0x5A5A60)
    }

    @Test("known brand takes precedence over category")
    func knownBrand() {
        let result = PlacePresentation.resolve(category: "cafe", brand: "Starbucks", name: "Starbucks République")
        #expect(result.key == "brand.starbucks")
        #expect(result.monogram == "S")
        #expect(result.hexColor == 0x006241)
    }

    @Test("name fallback recognizes a known brand when the API brand is absent")
    func nameFallback() {
        let result = PlacePresentation.resolve(category: "cafe", brand: nil, name: "Tim Hortons Montmartre")
        #expect(result.key == "brand.tim-hortons")
        #expect(result.monogram == "TH")
    }

    @Test("bakery uses a dark foreground for contrast")
    func bakeryContrast() {
        #expect(PlacePresentation.resolve(category: "bakery", brand: nil, name: "Bread").foreground == .dark)
    }
}
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `scripts/ios-test --only WorkInCafeTests/PlacePresentationTests`

Expected: compilation fails because `PlacePresentation` and `PlaceSummary.presentation` do not exist.

- [x] **Step 3: Implement the canonical presentation model and design tokens**

Implement `PlacePresentation` as an immutable `Sendable` value with `key`, `label`, `symbolName`, `monogram`, `hexColor`, and `foreground`. Normalize brand/name with lowercasing, diacritic folding, and punctuation removal. Register exactly Starbucks, Tim Hortons, McDonald's, WeWork, Anticafé, and De Mello; otherwise use the eight canonical category identities. Add `Color(hex:)`, semantic WorkinCafe colors, spacing `8/12/16/20/24`, radii `8/12/16/24/32`, and `44` point minimum targets.

```swift
struct PlacePresentation: Hashable, Sendable {
    enum Foreground: Hashable, Sendable { case light, dark }
    let key: String
    let label: String
    let symbolName: String
    let monogram: String?
    let hexColor: UInt32
    let foreground: Foreground

    static func resolve(category: String, brand: String?, name: String) -> Self
}

extension PlaceSummary {
    var presentation: PlacePresentation {
        .resolve(category: category, brand: brand, name: name)
    }
}
```

- [x] **Step 4: Implement reusable identity and rating components**

`PlaceIdentityBadge` renders the resolved monogram or SF Symbol in a category/brand circle, exposes a single useful accessibility label, and supports 32, 40, and 52 point sizes. `WorkRatingView` omits nil/zero ratings and renders valid ratings as `x.x/10` with tabular digits and a star symbol.

```swift
struct PlaceIdentityBadge: View {
    let place: PlaceSummary
    let size: CGFloat
    var body: some View { /* circle, identity content, accessible label */ }
}

struct WorkRatingView: View {
    enum LabelStyle { case compact, full }
    let rating: Double?
    let labelStyle: LabelStyle
    var body: some View { /* EmptyView for absent values; x.x/10 otherwise */ }
}
```

- [x] **Step 5: Run focused and full native tests**

Run: `scripts/ios-test --only WorkInCafeTests/PlacePresentationTests`

Expected: the new suite passes.

Run: `scripts/ios-test --only WorkInCafeTests`

Expected: all native unit suites pass.

- [x] **Step 6: Commit the design foundation**

```bash
git add ios/WorkInCafe/Core/DesignSystem ios/WorkInCafe/Core/Models/PlaceSummary.swift ios/WorkInCafe/Features/Place ios/WorkInCafeTests/Core/PlacePresentationTests.swift ios/WorkInCafeTests/Support/PlaceFixture.swift
git commit -m $'feat(ios): establish WorkinCafe place identity\n\nRefs #310\n\n— gib'
```

### Task 2: Composition root, router, deterministic fixtures, and product dock

**Files:**
- Create: `ios/WorkInCafe/App/AppEnvironment.swift`
- Replace: `ios/WorkInCafe/App/AppRootState.swift`
- Replace: `ios/WorkInCafe/App/AppRootView.swift`
- Create: `ios/WorkInCafe/App/RootProductDock.swift`
- Create: `ios/WorkInCafe/Core/API/FixturePlacesAPI.swift`
- Create: `ios/WorkInCafeTests/Core/AppRouterTests.swift`
- Modify: `ios/WorkInCafeTests/Core/AppRootStateTests.swift`

**Interfaces:**
- Consumes: `PlacesServing`, `PlaceCaching`, `MapFeatureModel`.
- Produces: `AppEnvironment.live()`, `AppEnvironment.fixture()`, `ProductMode`, `AppRoute`, `AppSheet`, `AppRouter`, and `RootProductDock(selection:)`.

- [x] **Step 1: Write failing router and environment-selection tests**

```swift
@MainActor
@Suite("App routing")
struct AppRouterTests {
    @Test func startsInWorkSpots() {
        let router = AppRouter()
        #expect(router.mode == .workSpots)
        #expect(router.workSpotsPath.isEmpty)
    }

    @Test func detailRouteCarriesOnlyStableIdentity() {
        let route = AppRoute.placeDetail(id: "place-1")
        #expect(route == .placeDetail(id: "place-1"))
    }

    @Test func switchingModePreservesEachNavigationPath() {
        let router = AppRouter()
        router.workSpotsPath.append(.placeDetail(id: "place-1"))
        router.mode = .profile
        #expect(router.workSpotsPath == [.placeDetail(id: "place-1")])
    }
}
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run: `scripts/ios-test --only WorkInCafeTests/AppRouterTests`

Expected: compilation fails because the router types do not exist.

- [x] **Step 3: Implement the environment and fixture switch**

Use `-ui-testing` in `ProcessInfo.processInfo.arguments` to choose fixture dependencies. Do not branch feature code on test mode.

```swift
struct AppEnvironment: Sendable {
    let placesAPI: any PlacesServing
    let placeCache: any PlaceCaching

    static func live() -> Self
    static func fixture() -> Self
    static func current(processInfo: ProcessInfo = .processInfo) -> Self
}
```

`FixturePlacesAPI` returns a fixed Paris set spanning café, library, bakery, coworking, and known-brand presentation. It performs no network access and is available only through the injected protocol.

- [x] **Step 4: Implement router and root product dock**

```swift
enum ProductMode: String, CaseIterable, Hashable { case profile, workSpots, cowork }
enum AppRoute: Hashable { case placeDetail(id: String) }
enum AppSheet: Identifiable, Equatable {
    case search, filters, placePreview(id: String)
    var id: String {
        switch self {
        case .search: "search"
        case .filters: "filters"
        case let .placePreview(id): "place-preview-\(id)"
        }
    }
}

@MainActor
final class AppRouter: ObservableObject {
    @Published var mode: ProductMode = .workSpots
    @Published var workSpotsPath: [AppRoute] = []
    @Published var profilePath: [AppRoute] = []
    @Published var coworkPath: [AppRoute] = []
    @Published var sheet: AppSheet?
}
```

The dock uses `person.crop.circle`, `mappin.and.ellipse`, and `person.2`, regular-to-fill state, a short selected underline, material capsule, 44-point targets, and explicit `accessibilityValue("Selected")`.

- [x] **Step 5: Wire the root without changing discovery visuals yet**

`AppRootView` owns one environment, router, and `MapFeatureModel`; Work spots temporarily hosts the existing map root while Profile and Cowork show honest `ContentUnavailableView` states. The dock remains over the three root modes and disappears for pushed details.

- [x] **Step 6: Run tests and commit**

Run: `scripts/ios-test --only WorkInCafeTests`

Expected: all unit suites pass.

```bash
git add ios/WorkInCafe/App ios/WorkInCafe/Core/API/FixturePlacesAPI.swift ios/WorkInCafeTests/Core
git commit -m $'feat(ios): add native product shell\n\nRefs #310\n\n— gib'
```

### Task 3: Correct discovery state, request identity, and safe bounds

**Files:**
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryMode.swift`
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryFilter.swift`
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryStore.swift`
- Create: `ios/WorkInCafe/Features/Map/MapCameraIntent.swift`
- Modify: `ios/WorkInCafe/Core/Models/PlaceSummary.swift`
- Modify: `ios/WorkInCafe/Core/API/PlacesAPI.swift`
- Modify: `ios/WorkInCafe/Features/Map/MapFeatureModel.swift`
- Create: `ios/WorkInCafeTests/Core/DiscoveryFilterTests.swift`
- Create: `ios/WorkInCafeTests/Core/DiscoveryStoreTests.swift`
- Modify: `ios/WorkInCafeTests/Core/MapFeatureModelTests.swift`
- Modify: `ios/WorkInCafeTests/Core/PlacesRequestBuilderTests.swift`

**Interfaces:**
- Consumes: `MapFeatureModel.places`, `PlaceSearchIndex`, `PlaceBounds`.
- Produces: `DiscoveryStore.filteredPlaces`, `DiscoveryStore.select(place:)`, `MapCameraIntent`, `PlaceBounds.isQueryable`, `PlaceBounds.normalizedSegments`, and generation-gated map publications.

- [x] **Step 1: Write failing filter, oversized-bounds, duplicate-ID, stale-request, and active-search tests**

Tests must prove:

```swift
#expect(PlaceBounds(west: -180, south: -80, east: 180, north: 80).isQueryable == false)
#expect(DiscoveryFilter(categories: ["library"], minimumRating: 8).includes(libraryRatedNine))
#expect(!DiscoveryFilter(categories: ["library"], minimumRating: 8).includes(cafeRatedNine))
#expect(PlaceSummary.deduplicated([older, newer]).map(\.id) == [older.id])
```

Use a controlled API to start request A, start request B, finish A, and assert A cannot clear B's loading state or replace B's results. Start a query against cached places, publish live places, and assert results recompute without editing the query.

- [x] **Step 2: Run the focused suites and verify they fail**

Run: `scripts/ios-test --only WorkInCafeTests/DiscoveryFilterTests --only WorkInCafeTests/DiscoveryStoreTests --only WorkInCafeTests/MapFeatureModelTests`

Expected: new assertions fail and missing types do not compile.

- [x] **Step 3: Implement filter/state types**

```swift
enum DiscoveryMode: String, CaseIterable, Sendable { case map = "Map"; case list = "List" }

struct DiscoveryFilter: Equatable, Sendable {
    var categories: Set<String> = []
    var minimumRating: Double?
    var activeCount: Int { categories.count + (minimumRating == nil ? 0 : 1) }
    func includes(_ place: PlaceSummary) -> Bool
}

@MainActor
final class DiscoveryStore: ObservableObject {
    @Published var mode: DiscoveryMode = .map
    @Published var query = ""
    @Published var filter = DiscoveryFilter()
    @Published var selectedPlaceID: String?
    @Published var cameraIntent: MapCameraIntent?
    var sourcePlaces: [PlaceSummary] = []
    var filteredPlaces: [PlaceSummary] { /* normalized query + filter */ }
    func select(place: PlaceSummary)
}
```

- [x] **Step 4: Implement safe bounds and request generations**

`PlaceBounds.isQueryable` rejects latitude spans above 2 degrees, longitude spans above 2 degrees, and non-finite coordinates. `normalizedSegments` returns one valid segment normally or two segments split at ±180. Preserve `URLError.cancelled` as cancellation. Deduplicate response IDs by first occurrence before reconciliation.

In `MapFeatureModel`, increment `requestGeneration` for every load, capture `(generation, requestKey)`, and gate success/error/loading publication on both matching values. Retain `activeSearchQuery` and recompute after every accepted source generation.

- [x] **Step 5: Run focused/full tests and commit**

Run: `scripts/ios-test --only WorkInCafeTests`

Expected: all unit suites pass, including stale request and search refresh cases.

```bash
git add ios/WorkInCafe/Core ios/WorkInCafe/Features/Discovery ios/WorkInCafe/Features/Map/MapCameraIntent.swift ios/WorkInCafe/Features/Map/MapFeatureModel.swift ios/WorkInCafeTests
git commit -m $'fix(ios): harden discovery state and requests\n\nRefs #310\n\n— gib'
```

### Task 4: Branded MapKit rendering and synchronized map/list shell

**Files:**
- Modify: `ios/WorkInCafe/Features/Map/MapAnnotations.swift`
- Modify: `ios/WorkInCafe/Features/Map/AnnotationReconciler.swift`
- Modify: `ios/WorkInCafe/Features/Map/MapViewRepresentable.swift`
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryScreen.swift`
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryListView.swift`
- Create: `ios/WorkInCafe/Features/Discovery/PlaceResultRow.swift`
- Delete: `ios/WorkInCafe/Features/Map/MapScreen.swift`
- Modify: `ios/WorkInCafe/App/AppRootView.swift`
- Modify: `ios/WorkInCafeTests/Core/AnnotationReconcilerTests.swift`
- Modify: `ios/WorkInCafeTests/Core/MapAnnotationTests.swift`

**Interfaces:**
- Consumes: `PlacePresentation`, `DiscoveryStore`, `MapFeatureModel`, `MapCameraIntent`.
- Produces: `MapViewRepresentable(places:selectedPlaceID:cameraIntent:onSelect:onBoundsChanged:)`, `DiscoveryScreen`, and shared `PlaceResultRow`.

- [x] **Step 1: Write failing minimal-annotation and safe-reconciliation tests**

```swift
let payload = PlaceAnnotationPayload(place: PlaceFixture.summary(id: "1", name: "Ten Belles"))
#expect(payload.id == "1")
#expect(payload.name == "Ten Belles")
#expect(payload.presentationKey == "category.cafe")
```

Pass duplicate incoming IDs to the reconciler and assert it returns one stable annotation instead of trapping.

- [x] **Step 2: Run focused tests and verify they fail**

Run: `scripts/ios-test --only WorkInCafeTests/MapAnnotationTests --only WorkInCafeTests/AnnotationReconcilerTests`

Expected: compilation fails because `PlaceAnnotationPayload` does not exist.

- [x] **Step 3: Replace default marker views with custom circular views**

`PlaceAnnotation` holds `PlaceAnnotationPayload` only: ID, coordinate, name, category label, rating, presentation key, symbol, monogram, background color, and foreground style. `PlaceAnnotationView` becomes `MKAnnotationView` with one `CAShapeLayer`, one centered `UILabel` or `UIImageView`, a 2-point white ring, controlled shadow, and 32/42 point normal/selected sizes. `ClusterAnnotationView` becomes a charcoal circular `MKAnnotationView` sized 34/40/46 by member count and uses white tabular text.

Selection uses `setSelected(_:animated:)`; Reduce Motion chooses immediate bounds/layer updates. Do not immediately deselect a place annotation. Cluster selection calls `showAnnotations` and then deselects the cluster only.

- [x] **Step 4: Implement safe reconciliation and camera coordination**

Replace every `Dictionary(uniqueKeysWithValues:)` over network-derived IDs with deterministic insertion. Configure `MKStandardMapConfiguration(elevationStyle: .flat)` with muted emphasis, excluded POIs, zoom range, user-location support, and compass. Debounce bounds publication for 250 ms in the coordinator; suppress unqueryable bounds and expose `onQueryabilityChanged(false)`.

- [x] **Step 5: Build the approved discovery shell**

`DiscoveryScreen` places a single top search/filter surface inside the safe area, a compact Map/List segmented picker, restrained location and Add place actions, and the product dock owned by the root. `DiscoveryListView` and map use the same `filteredPlaces` and selected ID. Selecting a row sets a camera intent and opens the preview. Empty, loading, stale/error, and zoom-in states remain visible without covering the whole map.

- [x] **Step 6: Run tests and build**

Run: `scripts/ios-test --only WorkInCafeTests`

Expected: unit tests pass.

Run: `xcodebuild -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -sdk iphonesimulator -configuration Debug build CODE_SIGNING_ALLOWED=NO`

Expected: `** BUILD SUCCEEDED **`.

- [x] **Step 7: Commit the branded discovery shell**

```bash
git add ios/WorkInCafe/App/AppRootView.swift ios/WorkInCafe/Features/Discovery ios/WorkInCafe/Features/Map ios/WorkInCafeTests/Core
git commit -m $'feat(ios): build branded map and list discovery\n\nRefs #310\n\n— gib'
```

### Task 5: Native search and honest filters

**Files:**
- Create: `ios/WorkInCafe/Features/Discovery/DiscoverySearchView.swift`
- Create: `ios/WorkInCafe/Features/Discovery/DiscoveryFilterView.swift`
- Modify: `ios/WorkInCafe/Features/Discovery/DiscoveryScreen.swift`
- Delete: `ios/WorkInCafe/Features/Search/SearchSheet.swift`
- Modify: `ios/WorkInCafeTests/Core/DiscoveryStoreTests.swift`
- Create: `ios/WorkInCafeUITests/DiscoverySearchFilterTests.swift`

**Interfaces:**
- Consumes: `DiscoveryStore.query`, `DiscoveryStore.filter`, `DiscoveryStore.filteredPlaces`.
- Produces: full-height search selection and filter application callbacks that update map/list selection consistently.

- [x] **Step 1: Add failing UI/unit tests for search refresh and filter removal**

Launch with `-ui-testing`, open `discovery.search`, search `Ten Belles`, select the result, and assert `place.preview` exists. Reopen filters, select Library, apply, assert the active filter chip `filter.active.library` exists, remove it, and assert it disappears.

- [x] **Step 2: Run focused tests and verify failure**

Run: `scripts/ios-test --only WorkInCafeTests/DiscoveryStoreTests --ui-only WorkInCafeUITests/DiscoverySearchFilterTests`

Expected: UI controls are not found because search/filter views do not exist.

- [x] **Step 3: Implement full-height native search**

Use `NavigationStack`, `.searchable`, dense `PlaceResultRow` rows, and quick category chips backed by real category values. Empty copy must suggest clearing filters, moving the map, or changing the term. Selecting a result dismisses search, switches to map, sets camera intent, keeps selection, and opens the preview.

- [x] **Step 4: Implement the native filter sheet**

Render category choices with canonical identity and a checkmark; use only actual 1–10 rating thresholds `7+`, `8+`, and `9+`. Keep edits in a local draft until Apply. The sticky safe-area button reads `Show N work spots` from the local currently loaded result set. Reset returns an empty filter. Do not show outlets, Wi-Fi, seating, open-now, or noise filters because slim viewport data cannot support them honestly.

- [x] **Step 5: Run unit/UI tests and commit**

Run: `scripts/ios-test --only WorkInCafeTests --ui-only WorkInCafeUITests/DiscoverySearchFilterTests`

Expected: search and filter tests pass.

```bash
git add ios/WorkInCafe/Features/Discovery ios/WorkInCafe/Features/Search ios/WorkInCafeTests ios/WorkInCafeUITests
git commit -m $'feat(ios): add native search and filters\n\nRefs #310\n\n— gib'
```

### Task 6: Selected-place preview and navigated full details

**Release prerequisite:** [Issue #309](https://github.com/gibouu/workincafe/issues/309) is release-blocking technical debt. Task 6 may be implemented and reviewed while #309 remains open, but no release candidate, TestFlight build, App Store submission, or production release may proceed until #309's eastbound/westbound model coverage and cached-data-on-crossing-failure regression are complete and the issue is closed.

**Files:**
- Delete: `ios/WorkInCafe/Features/Place/PlaceSheet.swift`
- Create: `ios/WorkInCafe/Features/Place/PlacePreviewSheet.swift`
- Create: `ios/WorkInCafe/Features/Place/PlaceDetailView.swift`
- Modify: `ios/WorkInCafe/App/AppRootView.swift`
- Modify: `ios/WorkInCafe/Features/Discovery/DiscoveryScreen.swift`
- Create: `ios/WorkInCafeUITests/PlaceFlowTests.swift`

**Interfaces:**
- Consumes: selected place ID resolved against current/cached place summaries, `AppRouter.workSpotsPath`, `AppleMapsDirections`.
- Produces: medium/large preview, stable detail route by place ID, share link, and honest summary-only detail hierarchy.

- [ ] **Step 1: Write a failing preview-to-detail UI test**

The fixture test taps `map.place.ten-belles`, verifies `place.preview`, `place.preview.rating`, and three actions (`place.preview.details`, `.save`, `.directions`), taps details, verifies `place.detail`, returns, and verifies selection remains on the map until the preview closes.

- [ ] **Step 2: Run the focused UI test and verify failure**

Run: `scripts/ios-test --ui-only WorkInCafeUITests/PlaceFlowTests`

Expected: preview/detail identifiers are absent.

- [ ] **Step 3: Implement the selected-place preview**

Use `.presentationDetents([.height(310), .medium, .large])` and a visible drag indicator. Render identity, name, neighborhood/address, `x.x/10` rating, validated/membership status only when present, plus View work spot, Save, and Directions actions. Because public viewport data has no reliable distance, Wi-Fi, noise, outlet, open-now, spend, or review-count values, omit those fields in this slice.

Save is visibly disabled with the accessibility hint `Sign in support is coming in the authenticated product slice`; it must not display fake success.

- [ ] **Step 4: Implement full detail as navigated content**

Push `.placeDetail(id:)` into the Work spots `NavigationStack`, resolve the place by ID, and show identity, address, work rating, directions, share, supported membership/validation information, and a clear partial-data state. Use a safe-area action bar for Directions and Share. Keep review, vitals, live conditions, menus, and business fields out until the detail-read API task provides them.

Move `AppleMapsDirections` into the detail file unchanged in behavior. Share an `https://www.workin.cafe/places/{id}` URL with `ShareLink`.

- [ ] **Step 5: Run full native verification and commit**

Run: `scripts/ios-test`

Expected: all unit and UI suites pass.

```bash
git add ios/WorkInCafe/App ios/WorkInCafe/Features/Discovery ios/WorkInCafe/Features/Place ios/WorkInCafeUITests
git commit -m $'feat(ios): add place preview and detail flow\n\nRefs #310\n\n— gib'
```

### Task 7: Visual companion, accessibility identifiers, and approved-size evidence

**Files:**
- Modify: `design/ios-companion/index.html`
- Modify: `design/ios-companion/styles.css`
- Preserve/modify only as necessary: `design/ios-companion/app.js`
- Create: `design/ios-companion/screens/002-native-representative-slice.json`
- Modify: `ios/WorkInCafeUITests/LaunchTests.swift`
- Create: `docs/ios/representative-slice-decisions.md`

**Interfaces:**
- Consumes: the finished native representative slice and approved visual decisions.
- Produces: persistent before/after browser comparison, position-aware notes, 320/393/430 screenshots, and an auditable visual decision record.

- [ ] **Step 1: Update the UI launch contract**

Launch with `-ui-testing` and assert `app.discovery.root`, `discovery.search`, `discovery.mode`, `product.work-spots`, `product.profile`, and `product.cowork`. Remove the obsolete assertion for the `Work in Cafe` title pill.

- [ ] **Step 2: Replace the companion mockup while preserving annotation behavior**

Build route-addressable panels for map, selected preview, detail, search, and filters at 320, 393, and 430 point widths. Use stable IDs such as `map.marker.cafe`, `map.cluster`, `place.preview`, `place.detail`, `search.results`, and `filters.categories`. Keep right-click note records with `screenId`, route, element ID, page-relative x/y, note, and timestamp. Preserve the revision-001 JSON before state.

- [ ] **Step 3: Document web-to-native decisions**

Record the exact category palette, marker/cluster treatment, semantic type mapping, 8/12/16/20/24 spacing rhythm, web density retained, web mechanics intentionally replaced, unsupported slim-data fields omitted, and the supported MapKit limitation that Apple cartography cannot exactly reproduce the web map styling.

- [ ] **Step 4: Run browser and native verification**

Run: `python3 -m http.server 64626 --directory design/ios-companion`

Expected: the companion loads and right-click notes persist across reloads.

Run: `scripts/ios-test`

Expected: all unit and UI tests pass.

Run the fixture app in Simulator at 320 × 568, 393 × 852, and 430 × 932 point-class layouts. Capture map, preview, detail, search, and filter screenshots for each class. Verify no clipped primary identity, overlapping safe-area controls, undersized hit targets, or inaccessible selection state.

- [ ] **Step 5: Commit the review surface and evidence**

```bash
git add design/ios-companion docs/ios/representative-slice-decisions.md ios/WorkInCafeUITests/LaunchTests.swift
git commit -m $'docs(ios): capture representative slice decisions\n\nRefs #310\n\n— gib'
```

### Task 8: Independent review, correction pass, and PR checkpoint

**Files:**
- Modify only files required by concrete review findings from Tasks 1–7.

**Interfaces:**
- Consumes: committed representative slice.
- Produces: reviewed branch and draft PR checkpoint; no archive/export/upload.

- [ ] **Step 1: Run the complete verification matrix**

Run: `npm test`

Expected: 63 web test files and 184 tests pass or a newer intentional baseline is documented.

Run: `scripts/ios-test`

Expected: all native unit and UI tests pass.

Run: `git diff --check origin/main...HEAD`

Expected: no whitespace errors.

Run: `git status --short`

Expected: no unintended generated or user files.

- [ ] **Step 2: Request independent specification and code-quality reviews**

Dispatch separate reviewers. The specification reviewer checks every representative-slice requirement against the approved design. The quality reviewer checks state ownership, concurrency, MapKit reuse, accessibility, performance, and test sufficiency. Address only evidenced findings and rerun the affected focused test first, then the full matrix.

- [ ] **Step 3: Review the branch diff in GitHub and open a draft PR**

Push `feat/310-native-product-rebuild`, open a draft PR with `Closes #310` only if this branch will contain the complete issue scope; otherwise use `Refs #310` because later authenticated/product slices remain. Include screenshots and a checked Test Plan. End the PR body with `— gib`.

- [ ] **Step 4: Hold at the visual approval gate**

Present the Simulator screenshots and companion to the user. Do not export, upload, submit, mark the full product complete, or merge solely because this representative slice passes. Continue into the separate consumer API/auth and remaining product-surface plans after explicit visual approval.

## Self-Review Record

- Spec coverage: main discovery, branded markers/clusters, selected preview, full detail navigation, search, filters, map/list parity, native navigation, accessibility, reduced motion, data truthfulness, deterministic fixtures, companion comparison, and release hold are each assigned to a task.
- Intentionally separate follow-on systems: versioned OpenAPI/bearer auth, full detail/review/menu reads, authentication, favorites, contributions, profile/account lifecycle, Add place, Cowork backend states, and App Store release are independent plans because each changes backend or privacy contracts and can be reviewed independently.
- Placeholder scan: no unfinished markers, open-ended error-handling instruction, or undefined later dependency remains in this plan. Unsupported fields are explicitly omitted instead of deferred inside the UI.
- Type consistency: `ProductMode`, `AppRoute`, `AppSheet`, `AppRouter`, `DiscoveryStore`, `DiscoveryFilter`, `MapCameraIntent`, `PlacePresentation`, and the map initializer are defined before their consumers.
