struct DiscoveryFilter: Equatable, Sendable {
    var categories: Set<String> = []
    var minimumRating: Double?

    var activeCount: Int {
        categories.count + (minimumRating == nil ? 0 : 1)
    }

    func includes(_ place: PlaceSummary) -> Bool {
        let includesCategory = categories.isEmpty || categories.contains(place.category)
        let includesRating = minimumRating.map { minimum in
            place.rating.map { $0 >= minimum } ?? false
        } ?? true
        return includesCategory && includesRating
    }
}
