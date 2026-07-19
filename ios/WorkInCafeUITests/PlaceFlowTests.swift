import XCTest

final class PlaceFlowTests: XCTestCase {
    @MainActor
    func testSelectedPlacePreviewNavigatesToDetailAndPreservesMapSelection() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-testing")
        app.launch()

        let marker = app.buttons["map.place.fixture-ten-belles"]
        XCTAssertTrue(marker.waitForExistence(timeout: 5))
        marker.tap()

        let preview = app.descendants(matching: .any)["place.preview"]
        XCTAssertTrue(preview.waitForExistence(timeout: 2))
        XCTAssertTrue(
            app.descendants(matching: .any)["place.preview.rating"]
                .waitForExistence(timeout: 2)
        )

        let details = app.buttons["place.preview.details"]
        let save = app.buttons["place.preview.save"]
        let directions = app.buttons["place.preview.directions"]
        XCTAssertTrue(details.waitForExistence(timeout: 2))
        XCTAssertTrue(save.waitForExistence(timeout: 2))
        XCTAssertFalse(save.isEnabled)
        XCTAssertTrue(directions.waitForExistence(timeout: 2))

        let previewScreenshot = XCTAttachment(screenshot: app.screenshot())
        previewScreenshot.name = "Selected place preview"
        previewScreenshot.lifetime = .keepAlways
        add(previewScreenshot)

        details.tap()

        let detail = app.descendants(matching: .any)["place.detail"]
        XCTAssertTrue(detail.waitForExistence(timeout: 2))

        let detailScreenshot = XCTAttachment(screenshot: app.screenshot())
        detailScreenshot.name = "Navigated place detail"
        detailScreenshot.lifetime = .keepAlways
        add(detailScreenshot)

        let backButton = app.buttons["BackButton"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2))
        backButton.tap()

        XCTAssertTrue(preview.waitForExistence(timeout: 2))
        XCTAssertTrue(marker.waitForExistence(timeout: 2))
        XCTAssertEqual(marker.value as? String, "Selected")
        app.buttons["place.close"].tap()

        XCTAssertFalse(preview.waitForExistence(timeout: 2))
        XCTAssertTrue(marker.waitForExistence(timeout: 2))
        XCTAssertEqual(marker.value as? String, "Not selected")
    }
}
