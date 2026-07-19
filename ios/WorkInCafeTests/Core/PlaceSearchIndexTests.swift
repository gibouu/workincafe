import Testing
@testable import WorkInCafe

@Suite("Local place search")
struct PlaceSearchIndexTests {
    @Test("matches name address and category without case or accents")
    func localFields() async {
        let places = [
            PlaceFixture.summary(id: "a", name: "Télescope", address: "Rue Villedo", category: "cafe"),
            PlaceFixture.summary(id: "b", name: "François-Mitterrand", address: "Quai Mauriac", category: "library"),
        ]
        let index = PlaceSearchIndex()

        #expect(await index.results(in: places, query: "telescope").map(\.id) == ["a"])
        #expect(await index.results(in: places, query: "quai").map(\.id) == ["b"])
        #expect(await index.results(in: places, query: "LIBRARY").map(\.id) == ["b"])
        #expect(await index.results(in: places, query: "  ") == places)
    }
}
