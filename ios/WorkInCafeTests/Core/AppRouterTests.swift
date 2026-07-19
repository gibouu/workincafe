import Testing
@testable import WorkInCafe

@MainActor
@Suite("App routing")
struct AppRouterTests {
    @Test func startsInWorkSpots() {
        let router = AppRouter()
        #expect(router.mode == .workSpots)
        #expect(router.workSpotsPath.isEmpty)
    }

    @Test func detailRouteCarriesOnlyStableIdentity() {
        let route = AppRoute.placeDetail(id: "place-1")
        #expect(route == .placeDetail(id: "place-1"))
    }

    @Test func switchingModePreservesEachNavigationPath() {
        let router = AppRouter()
        router.workSpotsPath.append(.placeDetail(id: "place-1"))
        router.mode = .profile
        #expect(router.workSpotsPath == [.placeDetail(id: "place-1")])
    }
}
