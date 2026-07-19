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
    @Published private(set) var selectedPlace: PlaceSummary?
    @Published var cameraIntent: MapCameraIntent?
    @Published var sourcePlaces: [PlaceSummary] = [] {
        didSet {
            selectedPlace = DiscoveryPresentationReconciler.reconcile(
                selectedPlace: selectedPlace,
                currentPlaces: sourcePlaces
            )
            sourceRevision &+= 1
            refreshFilteredPlaces()
        }
    }
    @Published private(set) var filteredPlaces: [PlaceSummary] = []
    @Published private(set) var sourceRevision: UInt = 0

    private var cameraRequestID: UInt = 0
    private var matchGeneration: UInt = 0
    private var matchingTask: Task<Void, Never>?

    var selectedPlaceID: String? {
        selectedPlace?.id
    }

    func select(place: PlaceSummary) {
        selectedPlace = place
        cameraRequestID &+= 1
        cameraIntent = .focus(
            requestID: cameraRequestID,
            placeID: place.id,
            latitude: place.latitude,
            longitude: place.longitude
        )
    }

    func place(id: String) -> PlaceSummary? {
        if selectedPlace?.id == id {
            return selectedPlace
        }
        return sourcePlaces.first { $0.id == id }
    }

    func clearSelection() {
        selectedPlace = nil
    }

    func invalidateSelection(id: String) {
        guard selectedPlace?.id == id else { return }
        selectedPlace = nil
    }

    func resetSearchContext() {
        query = ""
        filter = DiscoveryFilter()
        clearSelection()
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
