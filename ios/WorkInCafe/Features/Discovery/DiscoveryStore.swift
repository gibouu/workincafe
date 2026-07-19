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
        didSet { refreshFilteredPlaces() }
    }
    @Published private(set) var filteredPlaces: [PlaceSummary] = []

    private var cameraRequestID: UInt = 0

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

    private func refreshFilteredPlaces() {
        filteredPlaces = DiscoveryPlaceMatcher(query: query, filter: filter)
            .filteredPlaces(in: sourcePlaces)
    }
}
