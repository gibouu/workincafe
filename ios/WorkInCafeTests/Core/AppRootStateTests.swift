import Testing
@testable import WorkInCafe

@Suite("App root")
struct AppRootStateTests {
    @MainActor
    @Test("production root starts in guest discovery")
    func guestDiscovery() {
        #expect(AppRootView().destination == .discovery)
    }
}
