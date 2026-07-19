import Foundation

struct DiscoveryPlaceMatcher: Sendable {
    let filter: DiscoveryFilter
    private let normalizedQuery: String

    init(query: String, filter: DiscoveryFilter) {
        self.filter = filter
        normalizedQuery = Self.normalized(query)
    }

    func matches(_ place: PlaceSummary) -> Bool {
        guard filter.includes(place) else { return false }
        guard !normalizedQuery.isEmpty else { return true }

        return [
            place.name,
            place.address,
            place.neighborhood,
            place.category,
            place.categoryLabel
        ]
        .map(Self.normalized)
        .contains { $0.contains(normalizedQuery) }
    }

    func filteredPlaces(in places: [PlaceSummary]) -> [PlaceSummary] {
        places.filter(matches)
    }

    func count(in places: [PlaceSummary]) -> Int {
        places.count(where: matches)
    }

    private static func normalized(_ value: String) -> String {
        value.folding(
            options: [.caseInsensitive, .diacriticInsensitive],
            locale: .current
        )
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
