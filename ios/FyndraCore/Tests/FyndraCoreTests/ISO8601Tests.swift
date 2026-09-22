import XCTest
@testable import FyndraCore

/// Pins the date parsing that `.iso8601` got wrong.
///
/// These assertions are deliberately about the parser rather than about a
/// decoded response: on macOS 26 / iOS 26 a response-level test passes even
/// with the broken strategy, because that Foundation accepts fractional
/// seconds anyway. Asserting on `ISO8601.date(from:)` directly means the
/// regression is caught on any OS the suite runs on.
final class ISO8601Tests: XCTestCase {
    /// The shape every API timestamp actually has: Prisma serialises Date
    /// through JSON.stringify, which always emits milliseconds.
    func testParsesFractionalSeconds() {
        let date = ISO8601.date(from: "2026-09-21T01:00:00.000Z")
        XCTAssertEqual(date?.timeIntervalSince1970, 1789952400)
    }

    func testFractionalSecondsAreNotDiscarded() {
        let date = ISO8601.date(from: "2026-09-21T01:00:00.250Z")
        XCTAssertEqual(date?.timeIntervalSince1970 ?? 0, 1789952400.25, accuracy: 0.001)
    }

    /// Still accepted, so a hand-written fixture or a future server that
    /// drops milliseconds doesn't break the client.
    func testParsesWithoutFractionalSeconds() {
        let date = ISO8601.date(from: "2026-09-21T01:00:00Z")
        XCTAssertEqual(date?.timeIntervalSince1970, 1789952400)
    }

    func testParsesANonUTCOffset() {
        let date = ISO8601.date(from: "2026-09-21T09:00:00.000+08:00")
        XCTAssertEqual(date?.timeIntervalSince1970, 1789952400, "HKT is UTC+8 — the same instant")
    }

    func testRejectsSomethingThatIsNotADate() {
        XCTAssertNil(ISO8601.date(from: "yesterday"))
        XCTAssertNil(ISO8601.date(from: ""))
    }

    /// The session expiry is the other Date on the wire, and a failure there
    /// breaks sign-in itself rather than one screen. The API builds this with
    /// `expiresAt.toISOString()` (api/src/routes/auth.ts), and toISOString
    /// always emits milliseconds — so the strict parse would have rejected
    /// every sign-in response.
    func testDecodesAnAuthResponseExpiryThroughTheClientsDecoder() throws {
        let json = """
        {"token":"tok","expiresAt":"2026-10-21T01:00:00.000Z",
         "profile":{"id":"u-1","email":"abc123@abcai.com","yoe":5,"keywords":["swift"],
         "submissionMode":"review_before_sending","markets":["HK"],
         "preferredLanguage":"en","dailySubmissionCap":20}}
        """
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = ISO8601.decoding
        let auth = try decoder.decode(AuthResponse.self, from: Data(json.utf8))

        XCTAssertEqual(auth.expiresAt.timeIntervalSince1970, 1792544400)
    }

    func testRoundTripsThroughTheClientsEncoder() throws {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = ISO8601.encoding
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = ISO8601.decoding

        let original = Date(timeIntervalSince1970: 1789952400.25)
        let encoded = try encoder.encode(["at": original])
        let decoded = try decoder.decode([String: Date].self, from: encoded)

        XCTAssertEqual(decoded["at"]?.timeIntervalSince1970 ?? 0, 1789952400.25, accuracy: 0.001)
    }
}
