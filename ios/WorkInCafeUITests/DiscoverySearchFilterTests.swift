import XCTest

final class DiscoverySearchFilterTests: XCTestCase {
    @MainActor
    func testSearchSelectionAndIndividualFilterRemoval() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing")
        app.launch()

        let search = app.buttons["discovery.search"]
        XCTAssertTrue(search.waitForExistence(timeout: 5))
        XCTAssertTrue(search.isHittable)
        XCTAssertGreaterThanOrEqual(search.frame.height, 44)
        search.tap()

        XCTAssertTrue(
            app.staticTexts["Searches work spots loaded for the current map area."]
                .waitForExistence(timeout: 2)
        )
        let searchScreenshot = XCTAttachment(screenshot: app.screenshot())
        searchScreenshot.name = "Native search"
        searchScreenshot.lifetime = .keepAlways
        add(searchScreenshot)

        let searchField = app.searchFields["Name, neighborhood, or address"]
        XCTAssertTrue(searchField.waitForExistence(timeout: 2))
        searchField.tap()
        searchField.typeText("Ten Belles")

        let tenBelles = app.buttons["search.result.fixture-ten-belles"]
        XCTAssertTrue(tenBelles.waitForExistence(timeout: 2))
        XCTAssertGreaterThanOrEqual(tenBelles.frame.height, 44)
        tenBelles.tap()

        XCTAssertTrue(
            app.descendants(matching: .any)["place.preview"].waitForExistence(timeout: 2)
        )
        app.buttons["place.close"].tap()

        let filters = app.buttons["discovery.filters"]
        XCTAssertTrue(filters.waitForExistence(timeout: 2))
        XCTAssertTrue(filters.isHittable)
        XCTAssertGreaterThanOrEqual(filters.frame.height, 44)
        filters.tap()

        let library = app.buttons["filter.category.library"]
        XCTAssertTrue(library.waitForExistence(timeout: 2))
        let filterScreenshot = XCTAttachment(screenshot: app.screenshot())
        filterScreenshot.name = "Native filters"
        filterScreenshot.lifetime = .keepAlways
        add(filterScreenshot)
        XCTAssertGreaterThanOrEqual(library.frame.height, 44)
        library.tap()

        let apply = app.buttons["filter.apply"]
        XCTAssertTrue(apply.waitForExistence(timeout: 2))
        XCTAssertGreaterThanOrEqual(apply.frame.height, 44)
        apply.tap()

        let activeLibrary = app.buttons["filter.active.library"]
        XCTAssertTrue(activeLibrary.waitForExistence(timeout: 2))
        XCTAssertGreaterThanOrEqual(activeLibrary.frame.height, 44)
        activeLibrary.tap()

        XCTAssertFalse(activeLibrary.waitForExistence(timeout: 1))
    }
}
