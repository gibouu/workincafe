import Combine
import Foundation

@MainActor
final class DiscoveryStore: ObservableObject {
    @Published var mode: DiscoveryMode = .map
    @Published var query = ""
    @Published var filter = DiscoveryFilter()
    @Published var selectedPlaceID: String?
    @Published var cameraIntent: MapCameraIntent?
    @Published var sourcePlaces: [PlaceSummary] = []

    var filteredPlaces: [PlaceSummary] {
        let needle = normalized(query)
        return sourcePlaces.filter { place in
            guard filter.includes(place) else { return false }
            guard !needle.isEmpty else { return true }
            return [place.name, place.address, place.neighborhood, place.category, place.categoryLabel]
                .map(normalized)
                .contains { $0.contains(needle) }
        }
    }

    func select(place: PlaceSummary) {
        selectedPlaceID = place.id
        cameraIntent = .focus(
            placeID: place.id,
            latitude: place.latitude,
            longitude: place.longitude
        )
    }

    private func normalized(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
