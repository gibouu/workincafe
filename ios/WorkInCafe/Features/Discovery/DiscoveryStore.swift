import Combine

@MainActor
final class DiscoveryStore: ObservableObject {
    @Published var mode: DiscoveryMode = .map
    @Published var query = ""
    @Published var filter = DiscoveryFilter()
    @Published var selectedPlaceID: String?
    @Published var cameraIntent: MapCameraIntent?
    @Published var sourcePlaces: [PlaceSummary] = []

    var filteredPlaces: [PlaceSummary] {
        DiscoveryPlaceMatcher(query: query, filter: filter)
            .filteredPlaces(in: sourcePlaces)
    }

    func select(place: PlaceSummary) {
        selectedPlaceID = place.id
        cameraIntent = .focus(
            placeID: place.id,
            latitude: place.latitude,
            longitude: place.longitude
        )
    }
}
