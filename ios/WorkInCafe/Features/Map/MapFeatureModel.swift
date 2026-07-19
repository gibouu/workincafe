import Combine
import Foundation

struct MapRequestIdentity: Hashable, Sendable {
    let generation: Int
    let requestKey: String
}

enum RequestDecision: Hashable, Sendable {
    case accepted
    case rejectedStale
    case failedCurrent
}

protocol RequestDecisionObserving: Sendable {
    func didDecide(_ decision: RequestDecision, for request: MapRequestIdentity) async
}

struct NoOpRequestDecisionObserver: RequestDecisionObserving {
    func didDecide(_ decision: RequestDecision, for request: MapRequestIdentity) async {}
}

@MainActor
final class MapFeatureModel: ObservableObject {
    private let api: any PlacesServing
    private let cache: any PlaceCaching
    private let searchIndex: PlaceSearchIndex
    private let requestDecisionObserver: any RequestDecisionObserving
    private var loadTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?
    private var currentRequestKey: String?
    private var requestGeneration = 0
    private var activeSearchQuery: String?
    private var hasStarted = false
    private var isReadingInitialCache = false
    private(set) var lastBounds: PlaceBounds

    @Published private(set) var places: [PlaceSummary] = []
    @Published private(set) var searchResults: [PlaceSummary] = []
    @Published private(set) var isLoading = true
    @Published private(set) var errorMessage: String?
    @Published var selectedPlace: PlaceSummary?

    init(
        api: any PlacesServing,
        cache: any PlaceCaching,
        searchIndex: PlaceSearchIndex = PlaceSearchIndex(),
        initialBounds: PlaceBounds = .paris,
        requestDecisionObserver: any RequestDecisionObserving = NoOpRequestDecisionObserver()
    ) {
        self.api = api
        self.cache = cache
        self.searchIndex = searchIndex
        self.requestDecisionObserver = requestDecisionObserver
        lastBounds = initialBounds
    }

    func start() {
        guard !hasStarted else { return }
        hasStarted = true
        isReadingInitialCache = true
        isLoading = places.isEmpty
        errorMessage = nil
        loadTask = Task { [weak self] in
            guard let self else { return }
            if let cached = try? await cache.load(), !cached.isEmpty {
                guard !Task.isCancelled else { return }
                publishPlaces(cached)
                isLoading = false
            }
            isReadingInitialCache = false
            guard !Task.isCancelled else { return }
            let bounds = lastBounds
            let request = beginRequest(for: bounds)
            await refresh(
                bounds: bounds,
                generation: request.generation,
                requestKey: request.requestKey
            )
        }
    }

    func viewportChanged(to bounds: PlaceBounds) {
        lastBounds = bounds
        guard hasStarted, !isReadingInitialCache else { return }
        guard bounds.requestKey != currentRequestKey else { return }
        load(bounds: bounds)
    }

    func retry() {
        load(bounds: lastBounds)
    }

    func search(_ query: String) {
        activeSearchQuery = query
        refreshSearchResults()
    }

    private func refreshSearchResults() {
        guard let activeSearchQuery else { return }
        searchTask?.cancel()
        let source = places
        searchTask = Task { [weak self] in
            guard let self else { return }
            let results = await searchIndex.results(in: source, query: activeSearchQuery)
            guard !Task.isCancelled else { return }
            searchResults = results
        }
    }

    private func load(bounds: PlaceBounds) {
        loadTask?.cancel()
        lastBounds = bounds
        let request = beginRequest(for: bounds)
        loadTask = Task { [weak self] in
            guard let self else { return }
            await refresh(
                bounds: bounds,
                generation: request.generation,
                requestKey: request.requestKey
            )
        }
    }

    private func beginRequest(for bounds: PlaceBounds) -> (generation: Int, requestKey: String) {
        requestGeneration += 1
        let requestKey = bounds.requestKey
        currentRequestKey = requestKey
        let generation = requestGeneration
        guard isCurrent(generation: generation, requestKey: requestKey) else {
            return (generation, requestKey)
        }
        isLoading = places.isEmpty
        errorMessage = nil
        return (generation, requestKey)
    }

    private func refresh(bounds: PlaceBounds, generation: Int, requestKey: String) async {
        let request = MapRequestIdentity(generation: generation, requestKey: requestKey)
        do {
            let freshPlaces = try await api.places(in: bounds)
            guard isCurrent(generation: generation, requestKey: requestKey) else {
                await requestDecisionObserver.didDecide(.rejectedStale, for: request)
                return
            }
            let acceptedPlaces = PlaceSummary.deduplicated(freshPlaces)
            publishPlaces(acceptedPlaces)
            isLoading = false
            errorMessage = nil
            await requestDecisionObserver.didDecide(.accepted, for: request)
            try? await cache.store(acceptedPlaces)
        } catch is CancellationError {
            return
        } catch {
            guard isCurrent(generation: generation, requestKey: requestKey) else {
                await requestDecisionObserver.didDecide(.rejectedStale, for: request)
                return
            }
            isLoading = false
            errorMessage = error.localizedDescription
            await requestDecisionObserver.didDecide(.failedCurrent, for: request)
        }
    }

    private func isCurrent(generation: Int, requestKey: String) -> Bool {
        requestGeneration == generation && currentRequestKey == requestKey
    }

    private func publishPlaces(_ sourcePlaces: [PlaceSummary]) {
        places = PlaceSummary.deduplicated(sourcePlaces)
        refreshSearchResults()
    }
}

extension PlaceBounds {
    static let paris = PlaceBounds(west: 2.224, south: 48.815, east: 2.469, north: 48.902)
}
