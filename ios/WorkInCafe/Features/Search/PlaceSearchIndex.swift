import Foundation

actor PlaceSearchIndex {
    func results(in places: [PlaceSummary], query: String) -> [PlaceSummary] {
        let needle = normalized(query)
        guard !needle.isEmpty else { return places }
        return places.filter { place in
            [place.name, place.address, place.neighborhood, place.category, place.categoryLabel]
                .map(normalized)
                .contains { $0.contains(needle) }
        }
    }

    private func normalized(_ value: String) -> String {
        value.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
