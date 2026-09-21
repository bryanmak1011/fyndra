import XCTest

/// The end-to-end walkthrough, run against the **real** API — no stub. It
/// is the device/simulator validation the plan asks for (quickstart.md,
/// T091's simulator equivalent): sign in, swipe a real ranked feed, watch
/// an application appear, and open it.
///
/// It needs the server, the worker and Postgres up, plus:
///
///     cd api && npm run seed:demo -- abc123@abcai.com
///
/// and `AUTH_BYPASS_EMAILS=abc123@abcai.com` in the API's environment, so it
/// is skipped automatically unless `FYNDRA_LIVE_WALKTHROUGH=1` is set. Every
/// screen it visits is attached as a screenshot, so a failed run shows what
/// the app actually looked like.
///
/// It signs in with the bypass account rather than a real one-time code
/// specifically so it is **repeatable**: a code is single-use by design, so
/// the earlier version of this test passed once and then failed on every
/// subsequent run until someone re-seeded — which is the worst property a
/// validation test can have. The real request-code → verify round trip is
/// covered against live Postgres by `api/tests/contract/auth.test.ts`, and
/// the code-entry UI by `SignInViewModelTests`.
final class DemoWalkthroughUITests: XCTestCase {
    private let email = "abc123@abcai.com"

    override func setUpWithError() throws {
        continueAfterFailure = false
        try XCTSkipUnless(
            ProcessInfo.processInfo.environment["FYNDRA_LIVE_WALKTHROUGH"] == "1",
            "Live walkthrough: needs the API, the worker and a seeded demo account."
        )
    }

    @MainActor
    private func capture(_ app: XCUIApplication, _ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    @MainActor
    private func element(_ identifier: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    @MainActor
    func testTheWholeJourneyAgainstTheRealServer() throws {
        let app = XCUIApplication()
        // A previous run leaves a valid 30-day token in the Keychain, which
        // would skip the sign-in half of the walkthrough entirely.
        app.launchArguments = ["-FyndraForgetToken"]
        app.launch()

        // 1. Sign in (FR-026). This account is on the server's
        //    AUTH_BYPASS_EMAILS list, so it goes straight through.
        let emailField = app.textFields["signIn.email"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 15))
        capture(app, "01-sign-in")
        emailField.tap()
        emailField.typeText(email)
        capture(app, "02-test-account-entered")
        app.buttons["signIn.sendCode"].tap()

        // 2. A real ranked feed from Postgres (FR-004, FR-004a)
        let card = element("feed.card.top", in: app)
        XCTAssertTrue(card.waitForExistence(timeout: 20), "the seeded feed should produce a card")
        XCTAssertFalse(
            app.textFields["signIn.code"].exists,
            "a bypass account must never see the one-time-code step"
        )
        capture(app, "03-job-feed")

        // 3. Pass on one, apply to the next (FR-005, FR-006, FR-023)
        app.buttons["feed.pass"].tap()
        XCTAssertTrue(element("feed.card.top", in: app).waitForExistence(timeout: 10))
        capture(app, "04-after-pass")

        app.buttons["feed.apply"].tap()
        // The push prompt appears at the first right swipe, not at launch
        // (T082) — dismiss it so the walkthrough can carry on.
        let allowPush = app.buttons["Allow"]
        if allowPush.waitForExistence(timeout: 5) { allowPush.tap() }
        capture(app, "05-after-apply")

        // 4. The application shows up in tracking (FR-011)
        app.tabBars.buttons.element(boundBy: 1).tap()
        XCTAssertTrue(element("tracking.list", in: app).waitForExistence(timeout: 20))
        capture(app, "06-application-tracking")

        app.cells.firstMatch.tap()
        XCTAssertTrue(element("applicationDetail", in: app).waitForExistence(timeout: 15))
        capture(app, "07-application-detail")

        // 5. Profile and settings
        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.tabBars.buttons.element(boundBy: 2).tap()
        XCTAssertTrue(app.staticTexts["Skills we found"].waitForExistence(timeout: 15))
        capture(app, "08-profile")

        app.tabBars.buttons.element(boundBy: 3).tap()
        XCTAssertTrue(element("settings.submissionMode", in: app).waitForExistence(timeout: 15))
        capture(app, "09-settings")
    }
}
