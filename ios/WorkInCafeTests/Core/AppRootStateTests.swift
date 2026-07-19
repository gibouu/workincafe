import Testing
@testable import WorkInCafe

@Suite("App root")
struct AppRootStateTests {
    @Test("starts in guest discovery")
    func guestDiscovery() {
        #expect(AppRootState().destination == .discovery)
    }
}
