import Foundation
import Testing
@testable import WorkInCafe

@Suite("Map feature lifecycle")
struct MapFeatureModelTests {
    @MainActor
    @Test("an early viewport callback cannot bypass the cache-first startup")
    func cachePrecedesInitialRefresh() async throws {
        let cached = [PlaceFixture.summary(id: "cached", name: "Cached café")]
        let fresh = [PlaceFixture.summary(id: "fresh", name: "Fresh café")]
        let cache = SuspendedPlaceCache(cached: cached)
        let api = SuspendedPlacesAPI()
        let model = MapFeatureModel(api: api, cache: cache)
        let viewport = PlaceBounds(west: 2.1, south: 48.7, east: 2.5, north: 49.0)

        model.start()
        for _ in 0..<1_000 {
            if await cache.hasStartedLoading { break }
            await Task.yield()
        }
        #expect(await cache.hasStartedLoading)
        model.viewportChanged(to: viewport)
        await cache.finishLoading()

        await waitUntil { model.places == cached }
        #expect(await api.requestedBounds == viewport)

        await api.succeed(with: fresh)
        await waitUntil { model.places == fresh }
    }

    @MainActor
    @Test("a stale success cannot clear or replace the active request")
    func staleSuccessCannotPublish() async {
        let requestA = PlaceBounds(west: 2.1, south: 48.7, east: 2.4, north: 49.0)
        let requestB = PlaceBounds(west: 2.2, south: 48.8, east: 2.5, north: 49.1)
        let stale = [PlaceFixture.summary(id: "stale", name: "Stale café")]
        let active = [PlaceFixture.summary(id: "active", name: "Active café")]
        let api = ControlledPlacesAPI()
        let model = MapFeatureModel(
            api: api,
            cache: EmptyPlaceCache(),
            initialBounds: requestA
        )

        model.start()
        await waitUntilAsync { await api.hasRequest(for: requestA) }
        model.viewportChanged(to: requestB)
        await waitUntilAsync { await api.hasRequest(for: requestB) }

        await api.succeed(requestA, with: stale)
        for _ in 0..<100 { await Task.yield() }

        #expect(model.isLoading)
        #expect(model.places.isEmpty)
        #expect(model.errorMessage == nil)

        await api.succeed(requestB, with: active)
        await waitUntil { model.places == active }
        #expect(!model.isLoading)
    }

    @MainActor
    @Test("a stale failure cannot clear the active request loading state")
    func staleFailureCannotPublish() async {
        let requestA = PlaceBounds(west: 2.1, south: 48.7, east: 2.4, north: 49.0)
        let requestB = PlaceBounds(west: 2.2, south: 48.8, east: 2.5, north: 49.1)
        let active = [PlaceFixture.summary(id: "active", name: "Active café")]
        let api = ControlledPlacesAPI()
        let model = MapFeatureModel(
            api: api,
            cache: EmptyPlaceCache(),
            initialBounds: requestA
        )

        model.start()
        await waitUntilAsync { await api.hasRequest(for: requestA) }
        model.viewportChanged(to: requestB)
        await waitUntilAsync { await api.hasRequest(for: requestB) }

        await api.fail(requestA, with: APIError.invalidResponse)
        for _ in 0..<100 {
            if !model.isLoading || model.errorMessage != nil { break }
            await Task.yield()
        }

        #expect(model.isLoading)
        #expect(model.errorMessage == nil)

        await api.succeed(requestB, with: active)
        await waitUntil { model.places == active }
    }

    @MainActor
    @Test("an active search recomputes when live places replace cached places")
    func activeSearchRefreshes() async {
        let cached = [PlaceFixture.summary(id: "cached", name: "Atlas Library")]
        let live = [PlaceFixture.summary(id: "live", name: "Atlas Café")]
        let cache = SuspendedPlaceCache(cached: cached)
        let api = ControlledPlacesAPI()
        let model = MapFeatureModel(api: api, cache: cache)

        model.start()
        await waitUntilAsync { await cache.hasStartedLoading }
        await cache.finishLoading()
        await waitUntil { model.places == cached }
        await waitUntilAsync { await api.hasRequest(for: .paris) }

        model.search("atlas")
        await waitUntil { model.searchResults == cached }

        await api.succeed(.paris, with: live)
        await waitUntil { model.places == live }
        await waitUntil { model.searchResults == live }
    }

    @MainActor
    @Test("cached duplicate IDs are removed before map publication")
    func cachedDuplicatesAreDeduplicated() async {
        let older = PlaceFixture.summary(id: "duplicate", name: "Older cached payload")
        let newer = PlaceFixture.summary(id: "duplicate", name: "Newer cached payload")
        let cache = SuspendedPlaceCache(cached: [older, newer])
        let api = SuspendedPlacesAPI()
        let model = MapFeatureModel(api: api, cache: cache)

        model.start()
        await waitUntilAsync { await cache.hasStartedLoading }
        await cache.finishLoading()

        await waitUntil { model.places == [older] }
        #expect(model.places == [older])

        await waitUntilAsync { await api.requestedBounds == .paris }
        await api.succeed(with: [older])
    }

    @MainActor
    private func waitUntil(
        _ condition: () -> Bool
    ) async {
        for _ in 0..<1_000 {
            if condition() { return }
            await Task.yield()
        }
        Issue.record("Timed out waiting for deterministic lifecycle state")
    }

    @MainActor
    private func waitUntilAsync(
        _ condition: () async -> Bool
    ) async {
        for _ in 0..<1_000 {
            if await condition() { return }
            await Task.yield()
        }
        Issue.record("Timed out waiting for deterministic asynchronous state")
    }
}

private actor EmptyPlaceCache: PlaceCaching {
    func load() async throws -> [PlaceSummary]? { nil }

    func store(_ places: [PlaceSummary]) async throws {}
}

private actor SuspendedPlaceCache: PlaceCaching {
    let cached: [PlaceSummary]
    private(set) var hasStartedLoading = false
    private var continuation: CheckedContinuation<[PlaceSummary]?, Never>?

    init(cached: [PlaceSummary]) {
        self.cached = cached
    }

    func load() async throws -> [PlaceSummary]? {
        hasStartedLoading = true
        return await withCheckedContinuation { continuation = $0 }
    }

    func finishLoading() {
        continuation?.resume(returning: cached)
        continuation = nil
    }

    func store(_ places: [PlaceSummary]) async throws {}
}

private actor SuspendedPlacesAPI: PlacesServing {
    private(set) var requestedBounds: PlaceBounds?
    private var continuation: CheckedContinuation<[PlaceSummary], any Error>?

    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary] {
        requestedBounds = bounds
        return try await withCheckedThrowingContinuation { continuation = $0 }
    }

    func succeed(with places: [PlaceSummary]) {
        continuation?.resume(returning: places)
        continuation = nil
    }
}

private actor ControlledPlacesAPI: PlacesServing {
    private var continuations: [String: CheckedContinuation<[PlaceSummary], any Error>] = [:]

    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary] {
        try await withCheckedThrowingContinuation { continuation in
            continuations[bounds.requestKey] = continuation
        }
    }

    func hasRequest(for bounds: PlaceBounds) -> Bool {
        continuations[bounds.requestKey] != nil
    }

    func succeed(_ bounds: PlaceBounds, with places: [PlaceSummary]) {
        continuations.removeValue(forKey: bounds.requestKey)?.resume(returning: places)
    }

    func fail(_ bounds: PlaceBounds, with error: any Error) {
        continuations.removeValue(forKey: bounds.requestKey)?.resume(throwing: error)
    }
}
