import Testing
@testable import WorkInCafe

@Suite("Public places response")
struct PlaceDecodingTests {
    @Test("decodes realistic places and tolerates missing optional values")
    func realisticFixture() throws {
        let response = try PlaceResponseDecoder().decode(PlaceFixture.response)

        #expect(response.places.count == 2)
        #expect(response.places[0].name == "Ten Belles")
        #expect(response.places[0].hasUserReviews)
        #expect(response.places[1].address.isEmpty)
        #expect(response.places[1].brand == nil)
        #expect(response.places[1].rating == nil)
    }
}
