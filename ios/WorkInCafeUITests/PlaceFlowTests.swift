import XCTest

final class PlaceFlowTests: XCTestCase {
    @MainActor
    func testSelectedPlacePreviewNavigatesToDetailAndPreservesMapSelection() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-ui-testing",
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryL",
        ]
        app.launch()

        let marker = app.buttons["map.place.fixture-ten-belles"]
        XCTAssertTrue(marker.waitForExistence(timeout: 5))
        assertMinimumTarget(marker)
        marker.tap()

        let preview = app.descendants(matching: .any)["place.preview"]
        XCTAssertTrue(preview.waitForExistence(timeout: 2))
        let previewRating = app.descendants(matching: .any)["place.preview.rating"]
        XCTAssertTrue(previewRating.waitForExistence(timeout: 2))
        XCTAssertEqual(previewRating.label, "Work rating 4.7 out of 10")
        XCTAssertTrue(app.staticTexts["Ten Belles"].exists)
        XCTAssertTrue(app.staticTexts["Bastille"].exists)
        XCTAssertTrue(app.staticTexts["Validated"].exists)

        let details = app.buttons["place.preview.details"]
        let save = app.buttons["place.preview.save"]
        let directions = app.buttons["place.preview.directions"]
        XCTAssertTrue(details.waitForExistence(timeout: 2))
        XCTAssertTrue(waitForHittable(details, timeout: 2))
        assertMinimumTarget(details)

        preview.swipeUp()
        XCTAssertTrue(save.waitForExistence(timeout: 2))
        XCTAssertFalse(save.isEnabled)
        XCTAssertTrue(directions.waitForExistence(timeout: 2))
        let directionsHittable = waitForHittable(directions, timeout: 2)
        let geometry = XCTAttachment(
            string: "Preview: \(preview.frame); Details: \(details.frame); Directions: \(directions.frame)"
        )
        geometry.name = "Normal preview action geometry"
        geometry.lifetime = .keepAlways
        add(geometry)
        XCTAssertTrue(directionsHittable)
        assertMinimumTarget(save)
        assertMinimumTarget(directions)

        let previewScreenshot = XCTAttachment(screenshot: app.screenshot())
        previewScreenshot.name = "Selected place preview"
        previewScreenshot.lifetime = .keepAlways
        add(previewScreenshot)

        if !details.isHittable {
            preview.swipeDown()
        }
        XCTAssertTrue(waitForHittable(details, timeout: 2))
        details.tap()

        let detail = app.descendants(matching: .any)["place.detail"]
        XCTAssertTrue(detail.waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Ten Belles"].exists)
        XCTAssertTrue(app.staticTexts["Bastille"].exists)
        XCTAssertTrue(app.staticTexts["Validated work spot"].exists)
        XCTAssertTrue(app.descendants(matching: .any)["place.detail.partial-data"].exists)
        XCTAssertEqual(
            app.descendants(matching: .any)["place.detail.rating"].label,
            "Work rating 4.7 out of 10"
        )

        let detailDirections = app.buttons["place.detail.directions"]
        let detailShare = app.buttons["place.detail.share"]
        XCTAssertTrue(detailDirections.waitForExistence(timeout: 2))
        XCTAssertTrue(detailShare.waitForExistence(timeout: 2))
        XCTAssertTrue(detailDirections.isHittable)
        XCTAssertTrue(detailShare.isHittable)
        assertMinimumTarget(detailDirections)
        assertMinimumTarget(detailShare)

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

    @MainActor
    func testPreviewPreservesIdentityAndStatusAtLargestAccessibilityText() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-ui-testing",
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryAccessibilityXXXL",
        ]
        app.launch()

        let marker = app.buttons["map.place.fixture-wework-lafayette"]
        XCTAssertTrue(marker.waitForExistence(timeout: 5))
        marker.tap()

        let preview = app.descendants(matching: .any)["place.preview"]
        XCTAssertTrue(preview.waitForExistence(timeout: 2))

        let name = app.descendants(matching: .any)["place.preview.name"]
        let location = app.descendants(matching: .any)["place.preview.location"]
        let validated = app.descendants(matching: .any)["place.preview.status.validated"]
        let membership = app.descendants(matching: .any)["place.preview.status.membership"]
        assertFullyVisible(name, inside: preview)
        assertFullyVisible(location, inside: preview)
        assertFullyVisible(validated, inside: preview)
        if !preview.frame.contains(membership.frame) {
            preview.swipeUp()
        }
        assertFullyVisible(membership, inside: preview)
        XCTAssertEqual(name.label, "WeWork La Fayette")
        XCTAssertTrue(location.label.contains("Faubourg-Montmartre"))
        XCTAssertEqual(validated.label, "Validated")
        XCTAssertEqual(membership.label, "Day pass required")
        XCTAssertLessThan(name.frame.maxY, location.frame.minY)
        XCTAssertLessThan(location.frame.maxY, validated.frame.minY)
        XCTAssertLessThan(validated.frame.maxY, membership.frame.minY)

        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Place preview at accessibility XXXL"
        screenshot.lifetime = .keepAlways
        add(screenshot)

        let details = app.buttons["place.preview.details"]
        if !details.isHittable {
            preview.swipeUp()
        }
        XCTAssertTrue(details.isHittable)
        assertMinimumTarget(details)
    }

    @MainActor
    func testPreviewSurvivesOmissionAndRefreshesOnSameIDReappearance() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-ui-testing",
            "-ui-testing-refresh-persistence",
            "-UIPreferredContentSizeCategoryName",
            "UICTContentSizeCategoryL",
        ]
        app.launch()

        let marker = app.buttons["map.place.fixture-ten-belles"]
        XCTAssertTrue(marker.waitForExistence(timeout: 5))
        marker.tap()

        let preview = app.descendants(matching: .any)["place.preview"]
        XCTAssertTrue(preview.waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Ten Belles"].exists)

        XCTAssertTrue(marker.waitForNonExistence(timeout: 4))
        XCTAssertTrue(preview.exists)
        XCTAssertTrue(app.staticTexts["Ten Belles"].exists)

        let details = app.buttons["place.preview.details"]
        XCTAssertTrue(details.isHittable)
        details.tap()
        let detail = app.descendants(matching: .any)["place.detail"]
        XCTAssertTrue(detail.waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Ten Belles"].exists)

        XCTAssertTrue(
            app.staticTexts["Ten Belles, refreshed"].waitForExistence(timeout: 8)
        )
        XCTAssertTrue(detail.exists)

        let backButton = app.buttons["BackButton"]
        XCTAssertTrue(backButton.waitForExistence(timeout: 2))
        backButton.tap()
        XCTAssertTrue(preview.waitForExistence(timeout: 2))
        XCTAssertTrue(app.staticTexts["Ten Belles, refreshed"].exists)
        XCTAssertTrue(marker.waitForExistence(timeout: 2))
        XCTAssertTrue(app.buttons["place.preview.details"].exists)
    }

    @MainActor
    private func assertMinimumTarget(
        _ element: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertGreaterThanOrEqual(element.frame.width, 44, file: file, line: line)
        XCTAssertGreaterThanOrEqual(element.frame.height, 44, file: file, line: line)
    }

    @MainActor
    private func assertFullyVisible(
        _ element: XCUIElement,
        inside container: XCUIElement,
        file: StaticString = #filePath,
        line: UInt = #line
    ) {
        XCTAssertTrue(element.exists, file: file, line: line)
        XCTAssertGreaterThan(element.frame.width, 0, file: file, line: line)
        XCTAssertGreaterThan(element.frame.height, 0, file: file, line: line)
        XCTAssertTrue(container.frame.contains(element.frame), file: file, line: line)
    }

    @MainActor
    private func waitForHittable(_ element: XCUIElement, timeout: TimeInterval) -> Bool {
        let expectation = XCTNSPredicateExpectation(
            predicate: NSPredicate(format: "hittable == true"),
            object: element
        )
        return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }
}
