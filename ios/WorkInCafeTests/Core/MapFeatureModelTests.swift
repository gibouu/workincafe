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
    private func waitUntil(
        _ condition: () -> Bool
    ) async {
        for _ in 0..<1_000 {
            if condition() { return }
            await Task.yield()
        }
        Issue.record("Timed out waiting for deterministic lifecycle state")
    }
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
