import Testing
@testable import WorkInCafe

@Suite("Discovery state")
@MainActor
struct DiscoveryStoreTests {
    @Test("normalizes search text before applying filters")
    func normalizedQueryAndFilter() {
        let library = PlaceFixture.summary(
            id: "library",
            name: "Bibliothèque Forney",
            address: "Rue du Figuier",
            category: "library",
            rating: 9
        )
        let cafe = PlaceFixture.summary(
            id: "cafe",
            name: "Bibliothèque Café",
            category: "cafe",
            rating: 9
        )
        let store = DiscoveryStore()
        store.sourcePlaces = [library, cafe]
        store.query = "  bibliotheque  "
        store.filter = DiscoveryFilter(categories: ["library"], minimumRating: 8)

        #expect(store.filteredPlaces == [library])
    }

    @Test("selecting a place synchronizes selection and map focus")
    func selectPlace() {
        let place = PlaceFixture.summary(
            id: "selected",
            name: "Selected café",
            latitude: 48.87,
            longitude: 2.36
        )
        let store = DiscoveryStore()

        store.select(place: place)

        #expect(store.selectedPlaceID == place.id)
        #expect(
            store.cameraIntent == .focus(
                placeID: place.id,
                latitude: place.latitude,
                longitude: place.longitude
            )
        )
    }

    @Test("exposes stable map and list labels")
    func discoveryModes() {
        #expect(DiscoveryMode.allCases.map(\.rawValue) == ["Map", "List"])
    }
}
