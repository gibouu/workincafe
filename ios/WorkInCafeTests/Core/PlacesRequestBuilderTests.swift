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

    @Test("rejects non-finite and oversized viewport bounds")
    func rejectsUnsafeBounds() throws {
        let builder = PlacesRequestBuilder(baseURL: try #require(URL(string: "https://workin.cafe")))
        let world = PlaceBounds(west: -180, south: -80, east: 180, north: 80)
        let tall = PlaceBounds(west: 2, south: 45, east: 3, north: 48)
        let wide = PlaceBounds(west: 2, south: 48, east: 5, north: 49)
        let nonFinite = PlaceBounds(west: .nan, south: 48, east: 3, north: 49)

        #expect(!world.isQueryable)
        #expect(!tall.isQueryable)
        #expect(!wide.isQueryable)
        #expect(!nonFinite.isQueryable)
        #expect(throws: APIError.invalidConfiguration) {
            try builder.request(for: world)
        }
    }

    @Test("normalizes ordinary and antimeridian bounds into stable request segments")
    func normalizedSegments() {
        let ordinary = PlaceBounds(west: 2.2, south: 48.8, east: 2.4, north: 48.9)
        let crossing = PlaceBounds(west: 179.5, south: -1, east: -179.5, north: 1)
        let positiveOvershoot = PlaceBounds(west: 179.3, south: -1, east: 180.3, north: 1)
        let negativeOvershoot = PlaceBounds(west: -180.3, south: -1, east: -179.3, north: 1)

        #expect(ordinary.normalizedSegments == [ordinary])
        #expect(
            crossing.normalizedSegments == [
                PlaceBounds(west: 179.5, south: -1, east: 180, north: 1),
                PlaceBounds(west: -180, south: -1, east: -179.5, north: 1),
            ]
        )
        #expect(
            positiveOvershoot.normalizedSegments == [
                PlaceBounds(west: 179.3, south: -1, east: 180, north: 1),
                PlaceBounds(west: -180, south: -1, east: -179.7, north: 1),
            ]
        )
        #expect(
            negativeOvershoot.normalizedSegments == [
                PlaceBounds(west: 179.7, south: -1, east: 180, north: 1),
                PlaceBounds(west: -180, south: -1, east: -179.3, north: 1),
            ]
        )
    }

    @Test("rejects latitude coordinates outside the valid geographic range")
    func rejectsInvalidLatitudes() {
        let invalidSouth = PlaceBounds(west: 2, south: -90.1, east: 3, north: -89)
        let invalidNorth = PlaceBounds(west: 2, south: 89, east: 3, north: 90.1)

        #expect(!invalidSouth.isQueryable)
        #expect(!invalidNorth.isQueryable)
        #expect(invalidSouth.normalizedSegments.isEmpty)
        #expect(invalidNorth.normalizedSegments.isEmpty)
    }

    @Test("preserves URL cancellation as task cancellation")
    func preservesCancellation() async throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [CancelledURLProtocol.self]
        let session = URLSession(configuration: configuration)
        defer { session.invalidateAndCancel() }
        let api = LivePlacesAPI(
            baseURL: try #require(URL(string: "https://workin.cafe")),
            session: session
        )

        do {
            _ = try await api.places(in: .paris)
            Issue.record("Expected URL cancellation to remain cancellation")
        } catch is CancellationError {
            // Expected.
        } catch {
            Issue.record("Expected CancellationError, received \(error)")
        }
    }
}

private final class CancelledURLProtocol: URLProtocol {
    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        client?.urlProtocol(self, didFailWithError: URLError(.cancelled))
    }

    override func stopLoading() {}
}
