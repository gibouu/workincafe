import Foundation

enum APIError: Error, Equatable, LocalizedError, Sendable {
    case invalidConfiguration
    case invalidResponse
    case httpStatus(Int)
    case transport(String)
    case contractMismatch

    var errorDescription: String? {
        switch self {
        case .invalidConfiguration: "The service address is invalid."
        case .invalidResponse, .contractMismatch: "Work in Cafe returned an unexpected response."
        case .httpStatus: "Work spots could not be refreshed."
        case .transport: "You appear to be offline."
        }
    }
}

struct PlacesRequestBuilder: Sendable {
    let baseURL: URL

    func request(for bounds: PlaceBounds) throws -> URLRequest {
        guard bounds.isQueryable else { throw APIError.invalidConfiguration }
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.invalidConfiguration
        }
        components.path = "/api/places"
        components.queryItems = [URLQueryItem(name: "bbox", value: bounds.queryValue)]
        guard let url = components.url else { throw APIError.invalidConfiguration }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadRevalidatingCacheData
        request.timeoutInterval = 20
        return request
    }
}

protocol PlacesServing: Sendable {
    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary]
}

actor LivePlacesAPI: PlacesServing {
    private let session: URLSession
    private let requestBuilder: PlacesRequestBuilder
    private let decoder = PlaceResponseDecoder()

    init(baseURL: URL, session: URLSession = .shared) {
        requestBuilder = PlacesRequestBuilder(baseURL: baseURL)
        self.session = session
    }

    func places(in bounds: PlaceBounds) async throws -> [PlaceSummary] {
        guard bounds.isQueryable else { throw APIError.invalidConfiguration }
        var combinedPlaces: [PlaceSummary] = []
        for segment in bounds.normalizedSegments {
            try Task.checkCancellation()
            combinedPlaces.append(contentsOf: try await places(inNormalizedSegment: segment))
        }
        return PlaceSummary.deduplicated(combinedPlaces)
    }

    private func places(inNormalizedSegment bounds: PlaceBounds) async throws -> [PlaceSummary] {
        let request = try requestBuilder.request(for: bounds)
        do {
            let (data, response) = try await session.data(for: request)
            try Task.checkCancellation()
            guard let response = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            guard response.statusCode == 200 else { throw APIError.httpStatus(response.statusCode) }
            do {
                return try decoder.decode(data).places
            } catch {
                throw APIError.contractMismatch
            }
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error.localizedDescription)
        }
    }
}

enum APIConfiguration {
    static var baseURL: URL {
        if let value = Bundle.main.object(forInfoDictionaryKey: "WORKINCAFE_API_BASE_URL") as? String,
           let url = URL(string: value), !value.isEmpty {
            return url
        }
        return URL(string: "https://www.workin.cafe")!
    }
}
