import Foundation

struct AppEnvironment: Sendable {
    let placesAPI: any PlacesServing
    let placeCache: any PlaceCaching

    static func live() -> Self {
        Self(
            placesAPI: LivePlacesAPI(baseURL: APIConfiguration.baseURL),
            placeCache: PlaceCache()
        )
    }

    static func fixture() -> Self {
        Self(
            placesAPI: FixturePlacesAPI(),
            placeCache: PlaceCache()
        )
    }

    static func current(processInfo: ProcessInfo = .processInfo) -> Self {
        processInfo.arguments.contains("-ui-testing") ? .fixture() : .live()
    }
}
