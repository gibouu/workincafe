import Testing
@testable import WorkInCafe

@Suite("Place sharing")
struct PlaceShareURLTests {
    @Test("uses the canonical singular public place route")
    func canonicalPlaceRoute() {
        let url = PlaceShareURL.url(for: "fixture-ten-belles")

        #expect(url.absoluteString == "https://www.workin.cafe/place/fixture-ten-belles")
    }
}
