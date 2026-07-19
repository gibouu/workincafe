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

        let searchCafe = app.buttons["search.category.cafe"]
        XCTAssertTrue(searchCafe.waitForExistence(timeout: 2))
        XCTAssertEqual(searchCafe.value as? String, "Not selected")
        XCTAssertFalse(searchCafe.isSelected)
        searchCafe.tap()
        XCTAssertEqual(searchCafe.value as? String, "Selected, checkmark visible")
        XCTAssertTrue(searchCafe.isSelected)
        let selectedQuickFilterScreenshot = XCTAttachment(screenshot: app.screenshot())
        selectedQuickFilterScreenshot.name = "Selected search quick filter"
        selectedQuickFilterScreenshot.lifetime = .keepAlways
        add(selectedQuickFilterScreenshot)
        searchCafe.tap()
        XCTAssertEqual(searchCafe.value as? String, "Not selected")
        XCTAssertFalse(searchCafe.isSelected)

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
        let apply = app.buttons["filter.apply"]
        XCTAssertTrue(apply.waitForExistence(timeout: 2))
        XCTAssertEqual(apply.label, "Show 1 work spot")
        let filterScreenshot = XCTAttachment(screenshot: app.screenshot())
        filterScreenshot.name = "Native filters"
        filterScreenshot.lifetime = .keepAlways
        add(filterScreenshot)
        XCTAssertGreaterThanOrEqual(library.frame.height, 44)
        library.tap()
        XCTAssertEqual(apply.label, "Show 0 work spots")
        XCTAssertGreaterThanOrEqual(apply.frame.height, 44)
        apply.tap()

        let activeLibrary = app.buttons["filter.active.library"]
        XCTAssertTrue(activeLibrary.waitForExistence(timeout: 2))
        XCTAssertGreaterThanOrEqual(activeLibrary.frame.height, 44)

        filters.tap()
        let reset = app.buttons["filter.reset"]
        XCTAssertTrue(reset.waitForExistence(timeout: 2))
        reset.tap()
        XCTAssertEqual(app.buttons["filter.apply"].label, "Show 1 work spot")
        app.buttons["filter.cancel"].tap()
        XCTAssertTrue(activeLibrary.waitForExistence(timeout: 2))

        activeLibrary.tap()
        XCTAssertFalse(activeLibrary.waitForExistence(timeout: 1))

        filters.tap()
        XCTAssertTrue(library.waitForExistence(timeout: 2))
        library.tap()
        app.buttons["filter.cancel"].tap()
        XCTAssertFalse(activeLibrary.waitForExistence(timeout: 1))

        filters.tap()
        let rating = app.buttons["filter.rating.7"]
        XCTAssertTrue(rating.waitForExistence(timeout: 2))
        rating.tap()
        XCTAssertEqual(app.buttons["filter.apply"].label, "Show 0 work spots")
        app.buttons["filter.apply"].tap()

        let activeRating = app.buttons["filter.active.rating.7"]
        XCTAssertTrue(activeRating.waitForExistence(timeout: 2))
        activeRating.tap()
        XCTAssertFalse(activeRating.waitForExistence(timeout: 1))
    }
}
