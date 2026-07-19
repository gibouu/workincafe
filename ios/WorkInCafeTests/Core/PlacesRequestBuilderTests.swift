import Foundation
import Testing
@testable import WorkInCafe

@Suite("Public places request")
struct PlacesRequestBuilderTests {
    @Test("resolves the generated app bundle API base URL")
    func generatedBundleConfiguration() throws {
        let configuredValue = try #require(
            Bundle.main.object(forInfoDictionaryKey: "WORKINCAFE_API_BASE_URL") as? String
        )

        #expect(configuredValue == "https://www.workin.cafe")
        #expect(APIConfiguration.baseURL == URL(string: configuredValue))
    }

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
