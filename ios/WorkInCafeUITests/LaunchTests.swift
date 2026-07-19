import XCTest

final class LaunchTests: XCTestCase {
    @MainActor
    func testLaunchesIntoGuestDiscovery() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.otherElements["app.discovery.root"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Work in Cafe"].exists)
        XCTAssertTrue(app.buttons["Search work spots"].exists)
    }
}
