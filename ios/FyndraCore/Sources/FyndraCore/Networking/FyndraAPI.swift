import Foundation

/// Everything the app asks of the server, as a protocol.
///
/// `APIClient` is the real implementation and the only one that ships. The
/// protocol exists so a view model can be unit-tested, and a UI test can
/// drive real screens, without a running server and a live database behind
/// them — an XCUITest that needs Postgres up is a test nobody runs.
public protocol FyndraAPI: Sendable {
    func setBearerToken(_ token: String?) async

    @discardableResult func requestLoginCode(email: String) async throws -> AuthResponse?
    func verifyLoginCode(email: String, code: String) async throws -> AuthResponse
    func registerDevice(pushToken: String, platform: String) async throws

    func getProfile() async throws -> UserProfile
    func updateProfile(_ update: UserProfileUpdate) async throws -> UserProfile
    func uploadCv(filename: String, fileData: Data) async throws -> CvDocument
    func getCv() async throws -> CvDocument

    func getFeed(limit: Int) async throws -> JobFeedPage
    func swipe(jobId: String, direction: SwipeDirection) async throws -> SwipeResult

    func getApplications(statuses: [ApplicationStatus]) async throws -> [Application]
    func getApplication(id: String) async throws -> ApplicationDetail
    func confirmApplication(id: String, editedAnswers: [EditedAnswer]) async throws -> Application
    func reportStatus(applicationId: String, status: ApplicationStatus, note: String?) async throws -> Application
    func markHandoffComplete(applicationId: String) async throws -> Application
    func answerQuestion(applicationId: String, questionId: String, answer: String, allowReuse: Bool) async throws -> Application
}

/// The defaults live here rather than on the protocol requirements, so a
/// conforming stub only has to implement the full-argument form.
public extension FyndraAPI {
    func registerDevice(pushToken: String) async throws {
        try await registerDevice(pushToken: pushToken, platform: "apns")
    }

    func getFeed() async throws -> JobFeedPage {
        try await getFeed(limit: 20)
    }

    func getApplications() async throws -> [Application] {
        try await getApplications(statuses: [])
    }

    func confirmApplication(id: String) async throws -> Application {
        try await confirmApplication(id: id, editedAnswers: [])
    }
}

extension APIClient: FyndraAPI {}
