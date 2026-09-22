import Foundation

/// Every endpoint in contracts/openapi.yaml, as one typed method each.
///
/// These live as an extension on `APIClient` rather than as a separate
/// service object so there is exactly one place that knows how to talk to
/// the server, and callers never hand-assemble a path or a JSON body.
public extension APIClient {
    // MARK: - Auth

    /// Always succeeds whether or not the account exists (FR-026) — the
    /// server refuses to leak which emails are registered.
    ///
    /// Returns a session only for a configured test account that skips code
    /// verification; `nil` means the ordinary path, i.e. go to the code
    /// step. See `LoginCodeResponse`.
    @discardableResult
    func requestLoginCode(email: String) async throws -> AuthResponse? {
        let response: LoginCodeResponse = try await send(
            APIRequest(
                path: "auth/request-code",
                method: "POST",
                body: try JSONEncoder().encode(["email": email]),
                requiresAuth: false
            )
        )
        return response.session
    }

    func verifyLoginCode(email: String, code: String) async throws -> AuthResponse {
        try await send(
            APIRequest(
                path: "auth/verify",
                method: "POST",
                body: try JSONEncoder().encode(["email": email, "code": code]),
                requiresAuth: false
            )
        )
    }

    func registerDevice(pushToken: String, platform: String) async throws {
        let _: EmptyResponse = try await send(
            APIRequest(
                path: "devices",
                method: "POST",
                body: try JSONEncoder().encode(["pushToken": pushToken, "platform": platform])
            )
        )
    }

    // MARK: - Profile

    func getProfile() async throws -> UserProfile {
        try await send(APIRequest(path: "profile"))
    }

    func updateProfile(_ update: UserProfileUpdate) async throws -> UserProfile {
        let encoder = JSONEncoder()
        return try await send(
            APIRequest(path: "profile", method: "PATCH", body: try encoder.encode(update))
        )
    }

    /// 202 means accepted for parsing, not parsed — the caller polls
    /// `getCv()` (or waits for a push) to learn the result.
    func uploadCv(filename: String, fileData: Data) async throws -> CvDocument {
        let mimeType = MultipartBody.mimeType(
            forPathExtension: (filename as NSString).pathExtension
        )
        let multipart = MultipartBody(
            fileField: "file",
            filename: filename,
            mimeType: mimeType,
            fileData: fileData
        )
        return try await send(
            APIRequest(
                path: "profile/cv",
                method: "POST",
                body: multipart.data,
                contentType: multipart.contentType
            )
        )
    }

    func getCv() async throws -> CvDocument {
        try await send(APIRequest(path: "profile/cv"))
    }

    // MARK: - Feed

    func getFeed(limit: Int) async throws -> JobFeedPage {
        try await send(
            APIRequest(path: "jobs/feed", query: [URLQueryItem(name: "limit", value: String(limit))])
        )
    }

    /// Returns as soon as the swipe is recorded; a right swipe's submission
    /// runs on the worker afterwards, so the deck never waits (FR-023).
    func swipe(jobId: String, direction: SwipeDirection) async throws -> SwipeResult {
        try await send(
            APIRequest(
                path: "jobs/\(jobId)/swipe",
                method: "POST",
                body: try JSONEncoder().encode(["direction": direction.rawValue])
            )
        )
    }

    // MARK: - Applications

    func getApplications(statuses: [ApplicationStatus]) async throws -> [Application] {
        try await send(
            APIRequest(
                path: "applications",
                query: statuses.map { URLQueryItem(name: "status", value: $0.rawValue) }
            )
        )
    }

    func getApplication(id: String) async throws -> ApplicationDetail {
        try await send(APIRequest(path: "applications/\(id)"))
    }

    func confirmApplication(id: String, editedAnswers: [EditedAnswer]) async throws -> Application {
        try await send(
            APIRequest(
                path: "applications/\(id)/confirm",
                method: "POST",
                body: try JSONEncoder().encode(["editedAnswers": editedAnswers])
            )
        )
    }

    func reportStatus(applicationId: String, status: ApplicationStatus, note: String?) async throws -> Application {
        var payload: [String: String] = ["status": status.rawValue]
        if let note, !note.isEmpty { payload["note"] = note }
        return try await send(
            APIRequest(
                path: "applications/\(applicationId)/status",
                method: "POST",
                body: try JSONEncoder().encode(payload)
            )
        )
    }

    func markHandoffComplete(applicationId: String) async throws -> Application {
        try await send(APIRequest(path: "applications/\(applicationId)/handoff-complete", method: "POST"))
    }

    /// `allowReuse` is ignored server-side for a sensitive question — those
    /// are never reused across applications (FR-022) — so the UI does not
    /// offer the choice there.
    func answerQuestion(
        applicationId: String,
        questionId: String,
        answer: String,
        allowReuse: Bool
    ) async throws -> Application {
        try await send(
            APIRequest(
                path: "applications/\(applicationId)/questions/\(questionId)/answer",
                method: "POST",
                body: try JSONEncoder().encode(AnswerPayload(answer: answer, allowReuse: allowReuse))
            )
        )
    }
}

/// `PATCH /profile`. Every field is optional: the server applies only what
/// is present, so a keyword correction never silently resets a setting.
public struct UserProfileUpdate: Codable, Sendable, Equatable {
    public var yoe: Int?
    public var keywords: [String]?
    public var submissionMode: SubmissionMode?
    public var markets: [Market]?
    public var preferredLanguage: AppLanguage?
    public var dailySubmissionCap: Int?
    public var perEmployerCap: Int?

    public init(
        yoe: Int? = nil,
        keywords: [String]? = nil,
        submissionMode: SubmissionMode? = nil,
        markets: [Market]? = nil,
        preferredLanguage: AppLanguage? = nil,
        dailySubmissionCap: Int? = nil,
        perEmployerCap: Int? = nil
    ) {
        self.yoe = yoe
        self.keywords = keywords
        self.submissionMode = submissionMode
        self.markets = markets
        self.preferredLanguage = preferredLanguage
        self.dailySubmissionCap = dailySubmissionCap
        self.perEmployerCap = perEmployerCap
    }
}

public struct EditedAnswer: Codable, Sendable, Equatable {
    public let fieldId: String
    public let answer: String

    public init(fieldId: String, answer: String) {
        self.fieldId = fieldId
        self.answer = answer
    }
}

private struct AnswerPayload: Encodable {
    let answer: String
    let allowReuse: Bool
}
