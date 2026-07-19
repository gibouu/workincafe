import Foundation
import Testing
@testable import WorkInCafe

@Suite("Public places request")
struct PlacesRequestBuilderTests {
    @Test("builds the bbox query against the configured base URL")
    func bboxQuery() throws {
        let builder = PlacesRequestBuilder(baseURL: try #require(URL(string: "https://workin.cafe")))
        let bounds = PlaceBounds(west: 2.2, south: 48.8, east: 2.4, north: 48.9)

        let request = try builder.request(for: bounds)
        let requestURL = try #require(request.url)
        let components = try #require(URLComponents(url: requestURL, resolvingAgainstBaseURL: false))

        #expect(components.path == "/api/places")
        #expect(components.queryItems == [URLQueryItem(name: "bbox", value: "2.2,48.8,2.4,48.9")])
        #expect(request.httpMethod == "GET")
    }
}
