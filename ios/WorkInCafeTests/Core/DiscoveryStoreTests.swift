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

    @Test("refreshes search results when the current discovery source changes")
    func refreshesSearchResultsFromCurrentSource() {
        let tenBelles = PlaceFixture.summary(
            id: "ten-belles",
            name: "Ten Belles"
        )
        let library = PlaceFixture.summary(
            id: "library",
            name: "Bibliothèque Forney",
            category: "library"
        )
        let store = DiscoveryStore()
        store.query = "ten belles"
        store.sourcePlaces = [library]

        #expect(store.filteredPlaces.isEmpty)

        store.sourcePlaces = [library, tenBelles]

        #expect(store.filteredPlaces == [tenBelles])
    }

    @Test("removing one category filter preserves the remaining criteria")
    func removesOnlyRequestedCategoryFilter() {
        var filter = DiscoveryFilter(
            categories: ["library", "cafe"],
            minimumRating: 8
        )

        filter.categories.remove("library")

        #expect(filter.categories == ["cafe"])
        #expect(filter.minimumRating == 8)
        #expect(filter.activeCount == 2)
    }

    @Test("search empty copy offers actions appropriate to the loaded map source")
    func honestEmptySearchCopy() {
        #expect(
            DiscoverySearchCopy.emptyDescription
                == "Clear filters, move the map, or try another search term."
        )
    }

    @Test("offers only real work-rating thresholds")
    func supportedRatingThresholds() {
        #expect(DiscoveryFilter.supportedMinimumRatings == [7, 8, 9])
    }

    @Test("category filters never inherit a place brand label")
    func categoryFilterIdentity() {
        let category = DiscoveryCategoryOption(category: "coworking")

        #expect(category.id == "coworking")
        #expect(category.label == "Coworking")
        #expect(category.symbolName == "briefcase.fill")
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
