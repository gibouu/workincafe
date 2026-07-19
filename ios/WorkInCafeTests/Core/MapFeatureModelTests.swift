import Combine
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
    @Test("a stale same-key success cannot clear or replace the active retry")
    func staleSameKeySuccessCannotPublish() async {
        let bounds = PlaceBounds(west: 2.1, south: 48.7, east: 2.4, north: 49.0)
        let stale = [PlaceFixture.summary(id: "stale", name: "Stale café")]
        let active = [PlaceFixture.summary(id: "active", name: "Active café")]
        let api = ControlledPlacesAPI()
        let decisions = RecordingRequestDecisionObserver()
        let model = MapFeatureModel(
            api: api,
            cache: EmptyPlaceCache(),
            initialBounds: bounds,
            requestDecisionObserver: decisions
        )
        let publications = MapFeaturePublicationRecorder(model: model)
        let requestAIdentity = MapRequestIdentity(generation: 1, requestKey: bounds.requestKey)
        let requestBIdentity = MapRequestIdentity(generation: 2, requestKey: bounds.requestKey)

        model.start()
        let requestA = await api.request(for: bounds, occurrence: 0)
        model.retry()
        let requestB = await api.request(for: bounds, occurrence: 1)

        await api.succeed(requestA, with: stale)
        #expect(await api.hasFinished(requestA))
        await decisions.wait(for: requestAIdentity, decision: .rejectedStale)

        #expect(!publications.places.contains(stale))
        #expect(publications.errors.allSatisfy { $0 == nil })
        #expect(publications.loadingStates.allSatisfy { $0 })
        #expect(model.places.isEmpty)
        #expect(model.isLoading)
        #expect(model.errorMessage == nil)

        await api.succeed(requestB, with: active)
        await decisions.wait(for: requestBIdentity, decision: .accepted)

        #expect(!publications.places.contains(stale))
        #expect(publications.errors.allSatisfy { $0 == nil })
        #expect(publications.loadingStates.dropLast().allSatisfy { $0 })
        #expect(model.places == active)
        #expect(!model.isLoading)
    }

    @MainActor
    @Test("a stale same-key failure cannot clear the active retry loading state")
    func staleSameKeyFailureCannotPublish() async {
        let bounds = PlaceBounds(west: 2.1, south: 48.7, east: 2.4, north: 49.0)
        let api = ControlledPlacesAPI()
        let decisions = RecordingRequestDecisionObserver()
        let model = MapFeatureModel(
            api: api,
            cache: EmptyPlaceCache(),
            initialBounds: bounds,
            requestDecisionObserver: decisions
        )
        let publications = MapFeaturePublicationRecorder(model: model)
        let requestAIdentity = MapRequestIdentity(generation: 1, requestKey: bounds.requestKey)
        let requestBIdentity = MapRequestIdentity(generation: 2, requestKey: bounds.requestKey)

        model.start()
        let requestA = await api.request(for: bounds, occurrence: 0)
        model.retry()
        let requestB = await api.request(for: bounds, occurrence: 1)

        await api.fail(requestA, with: APIError.invalidResponse)
        #expect(await api.hasFinished(requestA))
        await decisions.wait(for: requestAIdentity, decision: .rejectedStale)

        #expect(publications.errors.allSatisfy { $0 == nil })
        #expect(publications.loadingStates.allSatisfy { $0 })
        #expect(model.places.isEmpty)
        #expect(model.isLoading)
        #expect(model.errorMessage == nil)

        await api.fail(requestB, with: APIError.invalidConfiguration)
        await decisions.wait(for: requestBIdentity, decision: .failedCurrent)

        #expect(publications.errors.dropLast().allSatisfy { $0 == nil })
        #expect(publications.errors.last != nil)
        #expect(publications.loadingStates.dropLast().allSatisfy { $0 })
        #expect(model.places.isEmpty)
        #expect(!model.isLoading)
        #expect(model.errorMessage != nil)
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
        let request = await api.request(for: .paris, occurrence: 0)

        model.search("atlas")
        await waitUntil { model.searchResults == cached }

        await api.succeed(request, with: live)
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
    struct Request: Hashable, Sendable {
        let id: Int
        let requestKey: String
    }

    private struct RequestWaiter {
        let requestKey: String
        let occurrence: Int
        let continuation: CheckedContinuation<Request, Never>
    }

    private var nextRequestID = 0
    private var requestsByKey: [String: [Request]] = [:]
    private var pendingResponses: [Int: CheckedContinuation<[PlaceSummary], any Error>] = [:]
    private var requestWaiters: [RequestWaiter] = []
    private var finishedRequestIDs = Set<Int>()
    private var finishWaiters: [Int: [CheckedContinuation<Void, Never>]] = [:]

    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary] {
        let request = Request(id: nextRequestID, requestKey: bounds.requestKey)
        nextRequestID += 1
        requestsByKey[request.requestKey, default: []].append(request)
        resumeRequestWaiters()

        do {
            let places = try await withCheckedThrowingContinuation { continuation in
                pendingResponses[request.id] = continuation
            }
            markFinished(request)
            return places
        } catch {
            markFinished(request)
            throw error
        }
    }

    func request(for bounds: PlaceBounds, occurrence: Int) async -> Request {
        let requestKey = bounds.requestKey
        if let requests = requestsByKey[requestKey], requests.indices.contains(occurrence) {
            return requests[occurrence]
        }
        return await withCheckedContinuation { continuation in
            requestWaiters.append(
                RequestWaiter(
                    requestKey: requestKey,
                    occurrence: occurrence,
                    continuation: continuation
                )
            )
        }
    }

    func succeed(_ request: Request, with places: [PlaceSummary]) async {
        pendingResponses.removeValue(forKey: request.id)?.resume(returning: places)
        await waitUntilFinished(request)
    }

    func fail(_ request: Request, with error: any Error) async {
        pendingResponses.removeValue(forKey: request.id)?.resume(throwing: error)
        await waitUntilFinished(request)
    }

    func hasFinished(_ request: Request) -> Bool {
        finishedRequestIDs.contains(request.id)
    }

    private func waitUntilFinished(_ request: Request) async {
        guard !finishedRequestIDs.contains(request.id) else { return }
        await withCheckedContinuation { continuation in
            finishWaiters[request.id, default: []].append(continuation)
        }
    }

    private func markFinished(_ request: Request) {
        finishedRequestIDs.insert(request.id)
        for waiter in finishWaiters.removeValue(forKey: request.id) ?? [] {
            waiter.resume()
        }
    }

    private func resumeRequestWaiters() {
        var pendingWaiters: [RequestWaiter] = []
        for waiter in requestWaiters {
            if let requests = requestsByKey[waiter.requestKey],
               requests.indices.contains(waiter.occurrence) {
                waiter.continuation.resume(returning: requests[waiter.occurrence])
            } else {
                pendingWaiters.append(waiter)
            }
        }
        requestWaiters = pendingWaiters
    }
}

private actor RecordingRequestDecisionObserver: RequestDecisionObserving {
    private struct Event: Hashable {
        let request: MapRequestIdentity
        let decision: RequestDecision
    }

    private var observedEvents = Set<Event>()
    private var waiters: [Event: [CheckedContinuation<Void, Never>]] = [:]

    func didDecide(_ decision: RequestDecision, for request: MapRequestIdentity) async {
        let event = Event(request: request, decision: decision)
        observedEvents.insert(event)
        for waiter in waiters.removeValue(forKey: event) ?? [] {
            waiter.resume()
        }
    }

    func wait(for request: MapRequestIdentity, decision: RequestDecision) async {
        let event = Event(request: request, decision: decision)
        guard !observedEvents.contains(event) else { return }
        await withCheckedContinuation { continuation in
            waiters[event, default: []].append(continuation)
        }
    }
}

@MainActor
private final class MapFeaturePublicationRecorder {
    private(set) var places: [[PlaceSummary]] = []
    private(set) var errors: [String?] = []
    private(set) var loadingStates: [Bool] = []
    private var cancellables = Set<AnyCancellable>()

    init(model: MapFeatureModel) {
        model.$places
            .sink { [weak self] places in
                MainActor.assumeIsolated {
                    self?.record(places)
                }
            }
            .store(in: &cancellables)
        model.$errorMessage
            .sink { [weak self] errorMessage in
                MainActor.assumeIsolated {
                    self?.errors.append(errorMessage)
                }
            }
            .store(in: &cancellables)
        model.$isLoading
            .sink { [weak self] isLoading in
                MainActor.assumeIsolated {
                    self?.loadingStates.append(isLoading)
                }
            }
            .store(in: &cancellables)
    }

    private func record(_ publishedPlaces: [PlaceSummary]) {
        places.append(publishedPlaces)
    }
}
