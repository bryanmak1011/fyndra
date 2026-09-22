import XCTest
@testable import FyndraCore

/// Exercises the typed endpoint layer against canned responses: what URL and
/// body each method actually puts on the wire, and that real server-shaped
/// JSON decodes into the model the UI expects. Fixtures below are copied
/// from what the Express routes serialize (api/src/routes/*.ts), not from
/// the contract's prose, so a drift between the two shows up here.
final class EndpointsTests: XCTestCase {
    private var captured: URLRequest?

    private func makeClient(status: Int = 200, json: String, token: String? = "t") -> APIClient {
        let data = Data(json.utf8)
        StubURLProtocol.handler = { request in (status, data) }
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [RecordingURLProtocol.self]
        RecordingURLProtocol.response = (status, data)
        RecordingURLProtocol.recorded = nil
        let session = URLSession(configuration: config)
        return APIClient(baseURL: URL(string: "http://localhost:3000/v1")!, token: token, session: session)
    }

    // MARK: - Feed

    private static let feedJSON = """
    {"items":[{"id":"job-1","sourceProvider":"jobsdb-hk","title":"Senior Backend Engineer",
      "employer":"Octopus Cards Limited","requirementsSummary":"TypeScript and Go.",
      "language":"en","market":"HK","applyRoute":"handoff","matchScore":0.82},
      {"id":"job-2","sourceProvider":"tw104","title":"資深後端工程師","employer":"玉山金控",
      "requirementsSummary":"五年以上工作經驗","language":"zh-Hant","market":"TW",
      "applyRoute":"handoff","matchScore":0.61}],"exhausted":false}
    """

    func testDecodesFeedPageIncludingZhHantPosting() async throws {
        let client = makeClient(json: Self.feedJSON)
        let page = try await client.getFeed(limit: 5)

        XCTAssertFalse(page.exhausted)
        XCTAssertEqual(page.items.count, 2)
        XCTAssertEqual(page.items[0].market, .hongKong)
        XCTAssertEqual(page.items[1].language, .zhHant)
        XCTAssertEqual(page.items[1].title, "資深後端工程師")
        XCTAssertNil(page.items[0].employerApplyUrl, "the feed omits the apply URL; it must not fail to decode")
    }

    func testFeedSendsLimitAsAQueryParameter() async throws {
        let client = makeClient(json: Self.feedJSON)
        _ = try await client.getFeed(limit: 7)

        let url = try XCTUnwrap(RecordingURLProtocol.recorded?.url)
        XCTAssertEqual(url.path, "/v1/jobs/feed")
        XCTAssertEqual(url.query, "limit=7")
    }

    func testStatusFilterSendsOneQueryItemPerStatus() async throws {
        let client = makeClient(json: "[]")
        _ = try await client.getApplications(statuses: [.applied, .interview])

        let url = try XCTUnwrap(RecordingURLProtocol.recorded?.url)
        XCTAssertEqual(url.query, "status=applied&status=interview")
    }

    // MARK: - Swipe

    func testSwipeSendsDirectionAndDecodesTheQueuedApplication() async throws {
        let json = """
        {"interactionId":"i-1","direction":"right","application":{"id":"a-1","jobPostingId":"job-1",
         "jobTitle":"Senior Backend Engineer","employer":"Octopus Cards Limited",
         "submissionMode":"review_before_sending","applyRoute":"handoff","status":"queued",
         "failureReason":null,"lastAttemptRef":null,"employerApplyUrl":null,"submittedAt":null,
         "answerSheet":[],"pendingQuestions":[]}}
        """
        let client = makeClient(json: json)
        let result = try await client.swipe(jobId: "job-1", direction: .right)

        XCTAssertEqual(result.direction, .right)
        XCTAssertEqual(result.application?.status, .queued)
        XCTAssertEqual(result.application?.jobTitle, "Senior Backend Engineer")

        let recorded = try XCTUnwrap(RecordingURLProtocol.recorded)
        XCTAssertEqual(recorded.httpMethod, "POST")
        XCTAssertEqual(recorded.url?.path, "/v1/jobs/job-1/swipe")
        let body = try XCTUnwrap(RecordingURLProtocol.recordedBody)
        XCTAssertEqual(try JSONDecoder().decode([String: String].self, from: body), ["direction": "right"])
    }

    func testLeftSwipeCarriesNoApplication() async throws {
        let client = makeClient(json: #"{"interactionId":"i-2","direction":"left","application":null}"#)
        let result = try await client.swipe(jobId: "job-2", direction: .left)

        XCTAssertEqual(result.direction, .left)
        XCTAssertNil(result.application)
    }

    // MARK: - Applications

    func testDecodesApplicationDetailFlattenedWithStatusHistory() async throws {
        let json = """
        {"id":"a-1","jobPostingId":"job-1","jobTitle":"iOS Engineer","employer":"Klook",
         "submissionMode":"review_before_sending","applyRoute":"handoff","status":"awaiting_review",
         "failureReason":null,"lastAttemptRef":"corr-9","employerApplyUrl":"https://example.test/apply",
         "submittedAt":null,
         "answerSheet":[{"fieldId":"f1","label":"Why this role?","answer":"Because…","source":"generated"}],
         "pendingQuestions":[{"id":"q1","questionText":"期望薪資","isSensitive":true,"answer":null}],
         "statusHistory":[{"status":"queued","occurredAt":"2026-09-21T01:00:00.000Z","note":null},
                          {"status":"awaiting_review","occurredAt":"2026-09-21T01:00:05.000Z","note":"ready"}]}
        """
        let client = makeClient(json: json)
        let detail = try await client.getApplication(id: "a-1")

        XCTAssertEqual(detail.application.status, .awaitingReview)
        XCTAssertEqual(detail.application.lastAttemptRef, "corr-9")
        XCTAssertEqual(detail.application.answerSheet.first?.source, .generated)
        XCTAssertEqual(detail.application.pendingQuestions.first?.isSensitive, true)
        XCTAssertEqual(detail.statusHistory.count, 2)
        XCTAssertEqual(detail.statusHistory.last?.note, "ready")
    }

    func testApplicationDecodesWhenAnswerSheetIsAbsentEntirely() throws {
        // The swipe route returns an application without these keys at all.
        let json = """
        {"id":"a-3","submissionMode":"auto_submit","applyRoute":"direct_submit_allowlisted","status":"queued"}
        """
        let application = try JSONDecoder().decode(Application.self, from: Data(json.utf8))

        XCTAssertEqual(application.answerSheet, [])
        XCTAssertEqual(application.pendingQuestions, [])
        XCTAssertNil(application.jobTitle)
    }

    func testAnswerPayloadCarriesAllowReuse() async throws {
        let json = """
        {"id":"a-1","submissionMode":"review_before_sending","applyRoute":"handoff","status":"queued"}
        """
        let client = makeClient(status: 202, json: json)
        _ = try await client.answerQuestion(
            applicationId: "a-1", questionId: "q1", answer: "Yes", allowReuse: false
        )

        let body = try XCTUnwrap(RecordingURLProtocol.recordedBody)
        let decoded = try JSONSerialization.jsonObject(with: body) as? [String: Any]
        XCTAssertEqual(decoded?["answer"] as? String, "Yes")
        XCTAssertEqual(decoded?["allowReuse"] as? Bool, false)
        XCTAssertEqual(
            RecordingURLProtocol.recorded?.url?.path,
            "/v1/applications/a-1/questions/q1/answer"
        )
    }

    // MARK: - Profile / CV

    func testProfileUpdateOmitsUnsetFieldsSoASettingIsNeverResetSilently() async throws {
        let json = """
        {"id":"p1","email":"a@example.com","yoe":5,"keywords":["Swift"],
         "submissionMode":"review_before_sending","markets":["HK"],"preferredLanguage":"en",
         "dailySubmissionCap":15,"submissionsUsedToday":2}
        """
        let client = makeClient(json: json)
        _ = try await client.updateProfile(UserProfileUpdate(keywords: ["Swift", "SwiftUI"]))

        let body = try XCTUnwrap(RecordingURLProtocol.recordedBody)
        let decoded = try XCTUnwrap(try JSONSerialization.jsonObject(with: body) as? [String: Any])
        XCTAssertEqual(decoded.keys.sorted(), ["keywords"])
        XCTAssertEqual(RecordingURLProtocol.recorded?.httpMethod, "PATCH")
    }

    func testCvUploadSendsAMultipartBodyWithTheFilePart() async throws {
        let json = """
        {"id":"cv-1","fileFormat":"pdf","parseStatus":"parsing","detectedLanguage":null,
         "rawExtractedKeywords":[],"rawExtractedYoe":null}
        """
        let client = makeClient(status: 202, json: json)
        let document = try await client.uploadCv(filename: "cv.pdf", fileData: Data("%PDF-1.4".utf8))

        XCTAssertEqual(document.parseStatus, .parsing)

        let recorded = try XCTUnwrap(RecordingURLProtocol.recorded)
        let contentType = try XCTUnwrap(recorded.value(forHTTPHeaderField: "Content-Type"))
        XCTAssertTrue(contentType.hasPrefix("multipart/form-data; boundary="), contentType)

        let body = try XCTUnwrap(RecordingURLProtocol.recordedBody)
        let text = try XCTUnwrap(String(data: body, encoding: .utf8))
        XCTAssertTrue(text.contains(#"name="file"; filename="cv.pdf""#), text)
        XCTAssertTrue(text.contains("Content-Type: application/pdf"), text)
        XCTAssertTrue(text.contains("%PDF-1.4"), text)
    }

    func testMatchPercentageNeverExceeds100() throws {
        // A real seeded feed produced 1.2 here and the card read "120%
        // match" — the server's score is a ranking value, not a fraction.
        func posting(score: Double) -> JobPosting {
            JobPosting(
                id: "j", sourceProvider: "demo-seed", title: "t", employer: "e",
                requirementsSummary: "", language: .en, market: .hongKong,
                applyRoute: .handoff, matchScore: score
            )
        }

        XCTAssertEqual(posting(score: 1.2).matchPercentage, 100)
        XCTAssertEqual(posting(score: 0.824).matchPercentage, 82)
        XCTAssertEqual(posting(score: 0).matchPercentage, 0)
        XCTAssertEqual(posting(score: -0.1).matchPercentage, 0)
    }

    func testDocxUploadIsSentWithTheWordMimeTypeTheServerExpects() throws {
        XCTAssertEqual(
            MultipartBody.mimeType(forPathExtension: "docx"),
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        XCTAssertEqual(MultipartBody.mimeType(forPathExtension: "PDF"), "application/pdf")
    }

    func testMapsA422IntoANamedUploadRejection() async {
        let client = makeClient(status: 422, json: #"{"code":"no_text_layer","message":"Scanned PDF"}"#)
        do {
            _ = try await client.uploadCv(filename: "scan.pdf", fileData: Data())
            XCTFail("expected a 422")
        } catch let APIClientError.server(status, body) {
            XCTAssertEqual(status, 422)
            XCTAssertEqual(CvUploadRejection(errorCode: body.code), .noTextLayer)
        } catch {
            XCTFail("wrong error: \(error)")
        }
    }
}

/// Like `StubURLProtocol` but records the request it was given, so a test can
/// assert on the URL, method and body actually sent.
final class RecordingURLProtocol: URLProtocol {
    nonisolated(unsafe) static var response: (Int, Data) = (200, Data())
    nonisolated(unsafe) static var recorded: URLRequest?
    nonisolated(unsafe) static var recordedBody: Data?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.recorded = request
        // URLSession moves an uploaded body to `httpBodyStream`, so reading
        // `httpBody` alone would see nil for every POST worth asserting on.
        Self.recordedBody = request.httpBody ?? request.httpBodyStream.map(Self.drain)
        let (status, data) = Self.response
        let response = HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func drain(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        var buffer = [UInt8](repeating: 0, count: bufferSize)
        while stream.hasBytesAvailable {
            let read = stream.read(&buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }
}
