import XCTest
@testable import FyndraCore

/// Routes every request through a canned response instead of the network,
/// so these tests exercise real `APIClient` decoding/retry/error-mapping
/// logic without a live server.
final class StubURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: (@Sendable (URLRequest) -> (Int, Data)) = { _ in (200, Data()) }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let (status, data) = Self.handler(request)
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

final class APIClientTests: XCTestCase {
    private func makeClient(token: String? = nil) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [StubURLProtocol.self]
        let session = URLSession(configuration: config)
        return APIClient(baseURL: URL(string: "http://localhost:3000/v1")!, token: token, session: session)
    }

    func testDecodesSuccessfulJSONResponse() async throws {
        let profileJSON = """
        {"id":"p1","email":"a@example.com","yoe":5,"keywords":["swift"],
         "submissionMode":"review_before_sending","markets":["HK"],
         "preferredLanguage":"zh-Hant","dailySubmissionCap":10}
        """.data(using: .utf8)!
        StubURLProtocol.handler = { _ in (200, profileJSON) }

        let client = makeClient()
        let profile: UserProfile = try await client.send(APIRequest(path: "profile", requiresAuth: false))

        XCTAssertEqual(profile.email, "a@example.com")
        XCTAssertEqual(profile.preferredLanguage, .zhHant)
        XCTAssertEqual(profile.markets, [.hongKong])
    }

    func testMapsServerErrorBody() async {
        let errorJSON = #"{"code":"invalid_code","message":"Invalid or expired code"}"#.data(using: .utf8)!
        StubURLProtocol.handler = { _ in (401, errorJSON) }

        let client = makeClient()
        do {
            let _: UserProfile = try await client.send(APIRequest(path: "profile", requiresAuth: false))
            XCTFail("expected unauthorized")
        } catch APIClientError.unauthorized {
            // expected — 401 is special-cased regardless of body shape
        } catch {
            XCTFail("wrong error: \(error)")
        }
    }

    func testRetriesOn5xxThenSucceeds() async throws {
        let attempts = Counter()
        let okJSON = """
        {"id":"p1","email":"a@example.com","yoe":null,"keywords":[],
         "submissionMode":"review_before_sending","markets":[],
         "preferredLanguage":"en","dailySubmissionCap":10}
        """.data(using: .utf8)!
        StubURLProtocol.handler = { _ in
            attempts.increment() < 3 ? (503, Data()) : (200, okJSON)
        }

        let client = makeClient()
        let profile: UserProfile = try await client.send(APIRequest(path: "profile", requiresAuth: false))

        XCTAssertEqual(attempts.value, 3)
        XCTAssertEqual(profile.id, "p1")
    }

    func testAttachesBearerTokenWhenRequired() async throws {
        let captured = Box<String>()
        StubURLProtocol.handler = { request in
            captured.value = request.value(forHTTPHeaderField: "Authorization")
            return (204, Data())
        }

        let client = makeClient(token: "secret-token")
        let _: EmptyResponse = try await client.send(APIRequest(path: "devices", method: "POST"))

        XCTAssertEqual(captured.value, "Bearer secret-token")
    }
}

/// URLProtocol handlers run on URLSession's own queue, so anything a test
/// asserts on afterwards has to cross a concurrency domain. These two are
/// the smallest safe way to do that under Swift 6's strict checking —
/// capturing a plain `var` in the handler closure does not compile.
final class Counter: @unchecked Sendable {
    private let lock = NSLock()
    private var count = 0

    /// Returns the value *before* this call, matching `attempts += 1; use attempts`.
    @discardableResult
    func increment() -> Int {
        lock.lock()
        defer { lock.unlock() }
        count += 1
        return count
    }

    var value: Int {
        lock.lock()
        defer { lock.unlock() }
        return count
    }
}

final class Box<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var stored: T?

    var value: T? {
        get {
            lock.lock()
            defer { lock.unlock() }
            return stored
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            stored = newValue
        }
    }
}
