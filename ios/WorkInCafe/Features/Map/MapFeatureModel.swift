import Combine
import Foundation

@MainActor
final class MapFeatureModel: ObservableObject {
    private let api: any PlacesServing
    private let cache: any PlaceCaching
    private let searchIndex: PlaceSearchIndex
    private var loadTask: Task<Void, Never>?
    private var searchTask: Task<Void, Never>?
    private var currentRequestKey: String?
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
        initialBounds: PlaceBounds = .paris
    ) {
        self.api = api
        self.cache = cache
        self.searchIndex = searchIndex
        lastBounds = initialBounds
    }

    func start() {
        guard loadTask == nil else { return }
        load(bounds: lastBounds, includeCache: true)
    }

    func viewportChanged(to bounds: PlaceBounds) {
        guard bounds.requestKey != currentRequestKey else { return }
        load(bounds: bounds, includeCache: false)
    }

    func retry() {
        currentRequestKey = nil
        load(bounds: lastBounds, includeCache: places.isEmpty)
    }

    func search(_ query: String) {
        searchTask?.cancel()
        let source = places
        searchTask = Task { [weak self] in
            guard let self else { return }
            let results = await searchIndex.results(in: source, query: query)
            guard !Task.isCancelled else { return }
            searchResults = results
        }
    }

    private func load(bounds: PlaceBounds, includeCache: Bool) {
        loadTask?.cancel()
        lastBounds = bounds
        currentRequestKey = bounds.requestKey
        isLoading = places.isEmpty
        errorMessage = nil
        loadTask = Task { [weak self] in
            guard let self else { return }
            if includeCache, let cached = try? await cache.load(), !cached.isEmpty {
                guard !Task.isCancelled else { return }
                places = cached
                isLoading = false
            }
            do {
                let freshPlaces = try await api.places(in: bounds)
                try Task.checkCancellation()
                places = freshPlaces
                isLoading = false
                errorMessage = nil
                try? await cache.store(freshPlaces)
            } catch is CancellationError {
                return
            } catch {
                isLoading = false
                errorMessage = error.localizedDescription
            }
        }
    }
}

extension PlaceBounds {
    static let paris = PlaceBounds(west: 2.224, south: 48.815, east: 2.469, north: 48.902)
}
