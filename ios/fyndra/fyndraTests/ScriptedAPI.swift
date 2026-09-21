import Foundation
@testable import FyndraCore

/// A `FyndraAPI` a test can script: hand it the pages to return, and it
/// records what was asked of it. Distinct from the app's `StubAPI`, which
/// simulates a whole coherent backend for UI tests — this one exists to
/// make a single behaviour observable.
actor ScriptedAPI: FyndraAPI {
    private var feedPages: [JobFeedPage]
    private let hangsOnSwipe: Bool
    private let swipeError: Error?
    private let failSubsequentFeeds: Bool

    private(set) var feedCallCount = 0
    private(set) var swipes: [(jobId: String, direction: SwipeDirection)] = []
    private(set) var profileUpdates: [UserProfileUpdate] = []
    private(set) var answeredQuestions: [(questionId: String, answer: String, allowReuse: Bool)] = []

    var profile = UserProfile(
        id: "p1",
        email: "demo@fyndra.test",
        yoe: 5,
        keywords: ["TypeScript"],
        submissionMode: .reviewBeforeSending,
        markets: [.hongKong],
        preferredLanguage: .en,
        dailySubmissionCap: 15,
        submissionsUsedToday: 0
    )
    var cv: CvDocument?
    var applications: [Application] = []
    var applicationDetail: ApplicationDetail?

    init(
        feedPages: [JobFeedPage] = [],
        hangsOnSwipe: Bool = false,
        swipeError: Error? = nil,
        failSubsequentFeeds: Bool = false
    ) {
        self.feedPages = feedPages
        self.hangsOnSwipe = hangsOnSwipe
        self.swipeError = swipeError
        self.failSubsequentFeeds = failSubsequentFeeds
    }

    func setBearerToken(_ token: String?) async {}

    /// Non-nil only when a test is exercising the code-skipping path.
    var bypassSession: AuthResponse?

    func setBypassSession(_ session: AuthResponse?) { bypassSession = session }

    func requestLoginCode(email: String) async throws -> AuthResponse? {
        requestedCodesFor.append(email)
        return bypassSession
    }

    private(set) var requestedCodesFor: [String] = []

    func verifyLoginCode(email: String, code: String) async throws -> AuthResponse {
        AuthResponse(token: "t", expiresAt: .now.addingTimeInterval(86_400), profile: profile)
    }

    func registerDevice(pushToken: String, platform: String) async throws {}

    func getProfile() async throws -> UserProfile { profile }

    func updateProfile(_ update: UserProfileUpdate) async throws -> UserProfile {
        profileUpdates.append(update)
        profile = UserProfile(
            id: profile.id,
            email: profile.email,
            yoe: update.yoe ?? profile.yoe,
            keywords: update.keywords ?? profile.keywords,
            submissionMode: update.submissionMode ?? profile.submissionMode,
            markets: update.markets ?? profile.markets,
            preferredLanguage: update.preferredLanguage ?? profile.preferredLanguage,
            dailySubmissionCap: update.dailySubmissionCap ?? profile.dailySubmissionCap,
            submissionsUsedToday: profile.submissionsUsedToday
        )
        return profile
    }

    func setCv(_ document: CvDocument?) { cv = document }
    func setApplications(_ list: [Application]) { applications = list }
    func setApplicationDetail(_ detail: ApplicationDetail?) { applicationDetail = detail }

    func uploadCv(filename: String, fileData: Data) async throws -> CvDocument {
        let document = CvDocument(id: "cv", fileFormat: .pdf, parseStatus: .succeeded,
                                  rawExtractedKeywords: ["Go"], rawExtractedYoe: 7)
        cv = document
        return document
    }

    func getCv() async throws -> CvDocument {
        guard let cv else { throw notFound }
        return cv
    }

    func getFeed(limit: Int) async throws -> JobFeedPage {
        feedCallCount += 1
        if feedPages.isEmpty {
            if failSubsequentFeeds { throw URLError(.notConnectedToInternet) }
            return JobFeedPage(items: [], exhausted: true)
        }
        return feedPages.removeFirst()
    }

    func swipe(jobId: String, direction: SwipeDirection) async throws -> SwipeResult {
        swipes.append((jobId, direction))
        if hangsOnSwipe {
            // Long enough that any await on it would be visible as a
            // failed assertion, short enough not to hang the suite.
            try? await Task.sleep(for: .seconds(5))
        }
        if let swipeError { throw swipeError }
        return SwipeResult(interactionId: "i", direction: direction, application: nil)
    }

    func getApplications(statuses: [ApplicationStatus]) async throws -> [Application] {
        statuses.isEmpty ? applications : applications.filter { statuses.contains($0.status) }
    }

    func getApplication(id: String) async throws -> ApplicationDetail {
        guard let applicationDetail else { throw notFound }
        return applicationDetail
    }

    func confirmApplication(id: String, editedAnswers: [EditedAnswer]) async throws -> Application {
        guard let application = applicationDetail?.application else { throw notFound }
        return application
    }

    func reportStatus(applicationId: String, status: ApplicationStatus, note: String?) async throws -> Application {
        guard let application = applicationDetail?.application else { throw notFound }
        return application
    }

    func markHandoffComplete(applicationId: String) async throws -> Application {
        guard let application = applicationDetail?.application else { throw notFound }
        return application
    }

    func answerQuestion(applicationId: String, questionId: String, answer: String, allowReuse: Bool) async throws -> Application {
        answeredQuestions.append((questionId, answer, allowReuse))
        guard let application = applicationDetail?.application else { throw notFound }
        return application
    }

    private var notFound: Error {
        APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "not found"))
    }
}
