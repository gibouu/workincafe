import Foundation

struct AppEnvironment: Sendable {
    let placesAPI: any PlacesServing
    let placeCache: any PlaceCaching
    let fixtureRefreshController: FixtureRefreshController?

    static func live() -> Self {
        Self(
            placesAPI: LivePlacesAPI(baseURL: APIConfiguration.baseURL),
            placeCache: PlaceCache(),
            fixtureRefreshController: nil
        )
    }

    static func fixture(refreshPersistence: Bool = false) -> Self {
        let controller = refreshPersistence ? FixtureRefreshController() : nil
        return Self(
            placesAPI: FixturePlacesAPI(refreshController: controller),
            placeCache: PlaceCache(),
            fixtureRefreshController: controller
        )
    }

    static func current(processInfo: ProcessInfo = .processInfo) -> Self {
        guard processInfo.arguments.contains("-ui-testing") else { return .live() }
        return .fixture(
            refreshPersistence: processInfo.arguments.contains("-ui-testing-refresh-persistence")
        )
    }
}
