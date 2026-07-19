import XCTest

final class LaunchTests: XCTestCase {
    @MainActor
    func testLaunchesIntoDiscoveryWithAccessibleModes() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing")
        app.launch()

        let root = app.otherElements["app.discovery.root"]
        let search = app.textFields["discovery.search"]
        let mode = app.descendants(matching: .any)["discovery.mode"]
        let dock = app.otherElements["product.dock"]

        XCTAssertTrue(root.waitForExistence(timeout: 5))
        XCTAssertTrue(search.waitForExistence(timeout: 2))
        XCTAssertTrue(mode.waitForExistence(timeout: 2))
        XCTAssertTrue(dock.waitForExistence(timeout: 2))

        let map = app.buttons["discovery.mode.map"]
        let list = app.buttons["discovery.mode.list"]

        XCTAssertTrue(map.isHittable)
        XCTAssertTrue(list.isHittable)
        XCTAssertGreaterThanOrEqual(map.frame.height, 44)
        XCTAssertGreaterThanOrEqual(list.frame.height, 44)

        list.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["discovery.list"].waitForExistence(timeout: 2)
        )
        XCTAssertTrue(app.staticTexts["Ten Belles"].waitForExistence(timeout: 2))
    }
}
