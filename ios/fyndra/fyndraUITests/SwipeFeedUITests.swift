import XCTest

/// T044, constitution II: the swipe is *the* critical flow, so it is
/// covered by a real UI test driving real gestures.
///
/// The app runs against its in-memory `StubAPI` (`-FyndraUITestStub`), so
/// these tests assert on the interface's behaviour and never on whether a
/// server, a database and a worker all happened to be up.
final class SwipeFeedUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    private func launch() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-FyndraUITestStub"]
        app.launch()
        return app
    }

    /// SwiftUI decides for itself which XCUIElement type a combined
    /// accessibility element becomes, and it is not stable across
    /// containers — matching on the identifier alone is what actually
    /// survives a layout change.
    @MainActor
    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    /// `press(forDuration:thenDragTo:)` only takes another element, so a
    /// free-form drag has to go through coordinates on both ends.
    @MainActor
    private func drag(_ element: XCUIElement, in app: XCUIApplication, toNormalisedX x: CGFloat) {
        let start = element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: end)
    }

    @MainActor
    func testTheTopCardShowsAJobAndACapCounter() {
        let app = launch()
        XCTAssertTrue(element("feed.card.top", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["0 of 15 used today"].exists)
    }

    @MainActor
    func testDraggingACardLeftAdvancesToTheNextJob() {
        let app = launch()
        let card = element("feed.card.top", in: app)
        XCTAssertTrue(card.waitForExistence(timeout: 10))
        let first = card.label

        drag(card, in: app, toNormalisedX: 0.02)

        let next = element("feed.card.top", in: app)
        XCTAssertTrue(next.waitForExistence(timeout: 5))
        XCTAssertNotEqual(next.label, first, "a left drag must advance the deck")
    }

    @MainActor
    func testDraggingACardRightCreatesAnApplication() {
        let app = launch()
        let card = element("feed.card.top", in: app)
        XCTAssertTrue(card.waitForExistence(timeout: 10))

        drag(card, in: app, toNormalisedX: 0.98)

        app.tabBars.buttons.element(boundBy: 1).tap()
        XCTAssertTrue(element("tracking.list", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["Senior Backend Engineer"].exists)
    }

    @MainActor
    func testTheApplyButtonIsEquivalentToASwipeRight() {
        // The gesture is not discoverable and not reachable for everyone —
        // the buttons must do the same thing (constitution III).
        let app = launch()
        XCTAssertTrue(element("feed.card.top", in: app).waitForExistence(timeout: 10))

        app.buttons["feed.apply"].tap()

        app.tabBars.buttons.element(boundBy: 1).tap()
        XCTAssertTrue(app.staticTexts["Senior Backend Engineer"].waitForExistence(timeout: 10))
    }

    @MainActor
    func testSwipingThroughEverythingReachesTheEndOfFeedState() {
        let app = launch()
        XCTAssertTrue(element("feed.card.top", in: app).waitForExistence(timeout: 10))

        // The stub serves three postings.
        for _ in 0..<3 {
            app.buttons["feed.pass"].tap()
        }

        XCTAssertTrue(element("feed.endOfFeed", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["No more matches"].exists)
    }

    @MainActor
    func testASensitiveQuestionExplainsWhyTheUserHasToAnswerIt() {
        // FR-022 is a promise to the user, not only a server rule: if the
        // screen does not say why it is asking, the carve-out reads as the
        // app being broken.
        let app = launch()
        XCTAssertTrue(element("feed.card.top", in: app).waitForExistence(timeout: 10))
        app.buttons["feed.apply"].tap()

        app.tabBars.buttons.element(boundBy: 1).tap()
        app.staticTexts["Senior Backend Engineer"].firstMatch.tap()

        XCTAssertTrue(app.staticTexts["Only you can answer this"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["期望薪資 (Expected salary)"].exists)
        XCTAssertFalse(
            app.switches["Save this answer for future applications"].exists,
            "reuse must not be offered at all for a sensitive question"
        )
    }

    @MainActor
    func testTrackingStartsEmptyWithAnExplanationRatherThanABlankScreen() {
        let app = launch()
        app.tabBars.buttons.element(boundBy: 1).tap()

        XCTAssertTrue(element("tracking.empty", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(app.staticTexts["No applications yet"].exists)
    }
}
