enum DiscoveryPresentationReconciler {
    static func reconcile(
        selectedPlace: PlaceSummary?,
        currentPlaces: [PlaceSummary]
    ) -> PlaceSummary? {
        guard let selectedPlace else { return nil }
        return currentPlaces.first { $0.id == selectedPlace.id } ?? selectedPlace
    }
}
