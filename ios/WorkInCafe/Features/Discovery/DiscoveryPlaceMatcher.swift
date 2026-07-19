import Foundation

actor DiscoveryMatchingWorker {
    static let shared = DiscoveryMatchingWorker()

    func filteredPlaces(
        in places: [PlaceSummary],
        query: String,
        filter: DiscoveryFilter
    ) -> [PlaceSummary] {
        DiscoveryPlaceMatcher(query: query, filter: filter)
            .filteredPlaces(in: places)
    }

    func count(
        in places: [PlaceSummary],
        query: String,
        filter: DiscoveryFilter
    ) -> Int {
        DiscoveryPlaceMatcher(query: query, filter: filter)
            .count(in: places)
    }
}

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

        let searchableText = [
            place.name,
            place.address,
            place.neighborhood,
            place.category,
            place.categoryLabel
        ]
        .joined(separator: "\u{1F}")

        return Self.normalized(searchableText).contains(normalizedQuery)
    }

    func filteredPlaces(in places: [PlaceSummary]) -> [PlaceSummary] {
        var result: [PlaceSummary] = []
        result.reserveCapacity(places.count)
        for place in places {
            guard !Task.isCancelled else { return [] }
            if matches(place) {
                result.append(place)
            }
        }
        return result
    }

    func count(in places: [PlaceSummary]) -> Int {
        var result = 0
        for place in places {
            guard !Task.isCancelled else { return 0 }
            if matches(place) {
                result += 1
            }
        }
        return result
    }

    private static func normalized(_ value: String) -> String {
        value.folding(
            options: [.caseInsensitive, .diacriticInsensitive],
            locale: .current
        )
        .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
