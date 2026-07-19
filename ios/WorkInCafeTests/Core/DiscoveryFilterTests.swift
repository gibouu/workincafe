import Testing
@testable import WorkInCafe

@Suite("Discovery filtering")
struct DiscoveryFilterTests {
    @Test("matches every selected category and rating constraint")
    func categoryAndRatingConstraints() {
        let libraryRatedNine = PlaceFixture.summary(
            id: "library",
            name: "Bibliothèque Forney",
            category: "library",
            rating: 9
        )
        let cafeRatedNine = PlaceFixture.summary(
            id: "cafe",
            name: "Ten Belles",
            category: "cafe",
            rating: 9
        )
        let filter = DiscoveryFilter(categories: ["library"], minimumRating: 8)

        #expect(filter.includes(libraryRatedNine))
        #expect(!filter.includes(cafeRatedNine))
    }

    @Test("rejects unrated places when a minimum rating is active")
    func unratedPlace() {
        let unratedLibrary = PlaceFixture.summary(
            id: "unrated",
            name: "Unrated library",
            category: "library"
        )

        #expect(!DiscoveryFilter(minimumRating: 8).includes(unratedLibrary))
    }

    @Test("counts active category and rating constraints")
    func activeCount() {
        let filter = DiscoveryFilter(categories: ["cafe", "library"], minimumRating: 8)

        #expect(filter.activeCount == 3)
    }

    @Test("deduplicates place IDs by preserving their first occurrence")
    func firstDuplicateWins() {
        let older = PlaceFixture.summary(id: "duplicate", name: "Older payload")
        let newer = PlaceFixture.summary(id: "duplicate", name: "Newer payload")

        let deduplicated = PlaceSummary.deduplicated([older, newer])

        #expect(deduplicated.map(\.id) == [older.id])
        #expect(deduplicated.map(\.name) == [older.name])
    }
}
