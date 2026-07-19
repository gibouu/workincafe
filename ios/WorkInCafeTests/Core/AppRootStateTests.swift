import Foundation
import Testing
@testable import WorkInCafe

@Suite("App environment")
struct AppRootStateTests {
    @Test("standard launch uses live dependencies")
    func standardLaunchUsesLiveDependencies() {
        let environment = AppEnvironment.current(
            processInfo: StubProcessInfo(arguments: ["WorkInCafe"])
        )

        #expect(environment.placesAPI is LivePlacesAPI)
        #expect(environment.placeCache is PlaceCache)
    }

    @Test("UI testing uses deterministic fixture dependencies")
    func uiTestingUsesFixtureDependencies() {
        let environment = AppEnvironment.current(
            processInfo: StubProcessInfo(arguments: ["WorkInCafe", "-ui-testing"])
        )

        #expect(environment.placesAPI is FixturePlacesAPI)
        #expect(environment.placeCache is PlaceCache)
    }

    @Test("fixture data covers representative Paris work spots")
    func fixtureDataCoversRepresentativeParisWorkSpots() async throws {
        let places = try await FixturePlacesAPI().places(in: .paris)

        #expect(Set(places.map(\.category)) == ["cafe", "library", "bakery", "coworking"])
        #expect(places.contains { $0.brand != nil })
    }
}

private final class StubProcessInfo: ProcessInfo, @unchecked Sendable {
    private let stubbedArguments: [String]

    init(arguments: [String]) {
        stubbedArguments = arguments
        super.init()
    }

    override var arguments: [String] { stubbedArguments }
}
