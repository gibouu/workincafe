import Testing
@testable import WorkInCafe

@Suite("Discovery state")
@MainActor
struct DiscoveryStoreTests {
    @Test("matcher normalizes case, accents, and surrounding whitespace")
    func matcherNormalizesQuery() {
        let library = PlaceFixture.summary(
            id: "library",
            name: "Bibliothèque Forney"
        )
        let matcher = DiscoveryPlaceMatcher(
            query: "  BIBLIOTHEQUE  ",
            filter: DiscoveryFilter()
        )

        #expect(matcher.matches(library))
    }

    @Test("matcher applies category criteria")
    func matcherAppliesCategory() {
        let cafe = PlaceFixture.summary(id: "cafe", name: "Café", category: "cafe")
        let library = PlaceFixture.summary(
            id: "library",
            name: "Library",
            category: "library"
        )
        let matcher = DiscoveryPlaceMatcher(
            query: "",
            filter: DiscoveryFilter(categories: ["library"])
        )

        #expect(!matcher.matches(cafe))
        #expect(matcher.matches(library))
    }

    @Test("matcher excludes an unrated place when a minimum rating is active")
    func matcherExcludesNilRating() {
        let unrated = PlaceFixture.summary(id: "unrated", name: "Unrated", rating: nil)
        let matcher = DiscoveryPlaceMatcher(
            query: "",
            filter: DiscoveryFilter(minimumRating: 8)
        )

        #expect(!matcher.matches(unrated))
    }

    @Test("matcher count agrees with the filtered discovery result")
    func matcherCountAgreement() {
        let places = [
            PlaceFixture.summary(id: "one", name: "Quiet Library", category: "library"),
            PlaceFixture.summary(id: "two", name: "Busy Library", category: "library"),
            PlaceFixture.summary(id: "three", name: "Quiet Café", category: "cafe")
        ]
        let matcher = DiscoveryPlaceMatcher(
            query: "quiet",
            filter: DiscoveryFilter(categories: ["library"])
        )

        #expect(matcher.count(in: places) == matcher.filteredPlaces(in: places).count)
        #expect(matcher.count(in: places) == 1)
    }

    @Test("invalid selected preview is dismissed when its place disappears")
    func dismissesInvalidSelectedPreview() {
        let reconciled = DiscoveryPresentationReconciler.reconcile(
            selectedPlaceID: "removed",
            sheet: .placePreview(id: "removed"),
            availablePlaceIDs: ["remaining"]
        )

        #expect(reconciled.selectedPlaceID == nil)
        #expect(reconciled.sheet == nil)
    }

    @Test(arguments: [AppSheet.search, AppSheet.filters])
    func preservesUnrelatedSheetWhenSelectedPlaceDisappears(sheet: AppSheet) {
        let reconciled = DiscoveryPresentationReconciler.reconcile(
            selectedPlaceID: "removed",
            sheet: sheet,
            availablePlaceIDs: ["remaining"]
        )

        #expect(reconciled.selectedPlaceID == nil)
        #expect(reconciled.sheet == sheet)
    }

    @Test("active category presentation survives a source refresh without that category")
    func activeCategoryPresentationSurvivesSourceRefresh() {
        let refreshedSource = [
            PlaceFixture.summary(id: "cafe", name: "Café", category: "cafe")
        ]
        let activeOptions = DiscoveryCategoryOption.activeOptions(for: ["library"])

        #expect(!refreshedSource.contains { $0.category == "library" })
        #expect(activeOptions.map(\.id) == ["library"])
        #expect(activeOptions.map(\.label) == ["Library"])
    }

    @Test("normalizes search text before applying filters")
    func normalizedQueryAndFilter() async {
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
        await store.waitForCurrentMatch()

        #expect(store.filteredPlaces == [library])
    }

    @Test("refreshes search results when the current discovery source changes")
    func refreshesSearchResultsFromCurrentSource() async {
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
        await store.waitForCurrentMatch()

        #expect(store.filteredPlaces.isEmpty)

        store.sourcePlaces = [library, tenBelles]
        await store.waitForCurrentMatch()

        #expect(store.filteredPlaces == [tenBelles])
    }

    @Test("publishes matching after the main-actor mutation returns")
    func publishesMatchingAsynchronously() async {
        let place = PlaceFixture.summary(id: "cafe", name: "Café")
        let store = DiscoveryStore()

        store.sourcePlaces = [place]

        #expect(store.filteredPlaces.isEmpty)
        await store.waitForCurrentMatch()
        #expect(store.filteredPlaces == [place])
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

    @Test("category filters preserve the canonical accessible foreground")
    func categoryFilterForeground() {
        #expect(DiscoveryCategoryOption(category: "cafe").foreground == .light)
        #expect(DiscoveryCategoryOption(category: "bakery").foreground == .dark)
        #expect(DiscoveryCategoryOption(category: "coworking").foreground == .dark)
        #expect(DiscoveryCategoryOption(category: "fast_food").foreground == .dark)
    }

    @Test("burger fast food keeps its canonical web label")
    func burgerFastFoodLabel() {
        #expect(
            DiscoveryCategoryOption(category: "fast_food_burger").label
                == "Fast food (burger)"
        )
    }

    @Test("filter result copy pluralizes work spot correctly")
    func filterResultCopy() {
        #expect(DiscoveryFilterCopy.applyTitle(count: 0) == "Show 0 work spots")
        #expect(DiscoveryFilterCopy.applyTitle(count: 1) == "Show 1 work spot")
        #expect(DiscoveryFilterCopy.applyTitle(count: 2) == "Show 2 work spots")
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
                requestID: 1,
                placeID: place.id,
                latitude: place.latitude,
                longitude: place.longitude
            )
        )
    }

    @Test("selecting the same place again emits a fresh map focus request")
    func reselectPlace() {
        let place = PlaceFixture.summary(
            id: "selected",
            name: "Selected café",
            latitude: 48.87,
            longitude: 2.36
        )
        let store = DiscoveryStore()

        store.select(place: place)
        let firstIntent = store.cameraIntent
        store.select(place: place)

        #expect(store.cameraIntent != firstIntent)
    }

    @Test("exposes stable map and list labels")
    func discoveryModes() {
        #expect(DiscoveryMode.allCases.map(\.rawValue) == ["Map", "List"])
    }
}
