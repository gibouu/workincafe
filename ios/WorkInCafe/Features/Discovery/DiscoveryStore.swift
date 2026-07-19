import Combine

@MainActor
final class DiscoveryStore: ObservableObject {
    @Published var mode: DiscoveryMode = .map
    @Published var query = "" {
        didSet { refreshFilteredPlaces() }
    }
    @Published var filter = DiscoveryFilter() {
        didSet { refreshFilteredPlaces() }
    }
    @Published var selectedPlaceID: String?
    @Published var cameraIntent: MapCameraIntent?
    @Published var sourcePlaces: [PlaceSummary] = [] {
        didSet {
            sourceRevision &+= 1
            refreshFilteredPlaces()
        }
    }
    @Published private(set) var filteredPlaces: [PlaceSummary] = []
    @Published private(set) var sourceRevision: UInt = 0

    private var cameraRequestID: UInt = 0
    private var matchGeneration: UInt = 0
    private var matchingTask: Task<Void, Never>?

    func select(place: PlaceSummary) {
        selectedPlaceID = place.id
        cameraRequestID &+= 1
        cameraIntent = .focus(
            requestID: cameraRequestID,
            placeID: place.id,
            latitude: place.latitude,
            longitude: place.longitude
        )
    }

    func waitForCurrentMatch() async {
        await matchingTask?.value
    }

    private func refreshFilteredPlaces() {
        matchingTask?.cancel()
        matchGeneration &+= 1
        let generation = matchGeneration
        let places = sourcePlaces
        let query = query
        let filter = filter

        matchingTask = Task { [weak self] in
            let matches = await DiscoveryMatchingWorker.shared.filteredPlaces(
                in: places,
                query: query,
                filter: filter
            )
            guard !Task.isCancelled,
                  let self,
                  matchGeneration == generation else { return }
            filteredPlaces = matches
        }
    }
}
