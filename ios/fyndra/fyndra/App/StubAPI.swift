#if DEBUG
import Foundation
import FyndraCore

/// An in-memory `FyndraAPI` used only when the app is launched with
/// `-FyndraUITestStub`, which only the UI test bundle does.
///
/// It exists so the UI tests can exercise the real views, view models and
/// gestures deterministically — a swipe test that depends on Postgres, a
/// worker process and a live LLM is a test that fails for reasons which
/// have nothing to do with the gesture. Compiled out of RELEASE entirely.
actor StubAPI: FyndraAPI {
    private var profile = UserProfile(
        id: "stub-profile",
        email: "demo@fyndra.test",
        yoe: 5,
        keywords: ["TypeScript", "PostgreSQL", "backend", "Go"],
        submissionMode: .reviewBeforeSending,
        markets: [.hongKong, .taiwan],
        preferredLanguage: .en,
        dailySubmissionCap: 15,
        submissionsUsedToday: 0
    )

    private var postings: [JobPosting] = [
        JobPosting(
            id: "job-1",
            sourceProvider: "jobsdb-hk",
            title: "Senior Backend Engineer",
            employer: "Octopus Cards Limited",
            requirementsSummary: "Design and operate payment services in TypeScript and Go. 5+ years building distributed systems, strong PostgreSQL, Kubernetes on AWS.",
            language: .en,
            market: .hongKong,
            applyRoute: .handoff,
            matchScore: 0.82
        ),
        JobPosting(
            id: "job-2",
            sourceProvider: "tw104",
            title: "資深後端工程師",
            employer: "玉山金控",
            requirementsSummary: "五年以上工作經驗，專長為後端系統開發與資料庫設計。熟悉 Node.js、TypeScript、PostgreSQL、雲端架構。",
            language: .zhHant,
            market: .taiwan,
            applyRoute: .handoff,
            matchScore: 0.61
        ),
        JobPosting(
            id: "job-3",
            sourceProvider: "jobsdb-hk",
            title: "iOS Engineer",
            employer: "Klook",
            requirementsSummary: "Swift and SwiftUI, iOS 17+, strong sense of product craft. You will own features end to end.",
            language: .en,
            market: .hongKong,
            applyRoute: .handoff,
            matchScore: 0.44
        ),
    ]

    private var applications: [Application] = []
    private var histories: [String: [ApplicationStatusEvent]] = [:]
    private var cv: CvDocument?

    func setBearerToken(_ token: String?) async {}

    func requestLoginCode(email: String) async throws -> AuthResponse? {
        // The stub build starts signed in, so this is never the way in.
        nil
    }

    func verifyLoginCode(email: String, code: String) async throws -> AuthResponse {
        AuthResponse(token: "stub-token", expiresAt: .now.addingTimeInterval(86_400), profile: profile)
    }

    func registerDevice(pushToken: String, platform: String) async throws {}

    func getProfile() async throws -> UserProfile { profile }

    func updateProfile(_ update: UserProfileUpdate) async throws -> UserProfile {
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

    func uploadCv(filename: String, fileData: Data) async throws -> CvDocument {
        let document = CvDocument(
            id: "stub-cv",
            fileFormat: filename.hasSuffix(".docx") ? .docx : .pdf,
            parseStatus: .succeeded,
            detectedLanguage: .en,
            rawExtractedKeywords: ["TypeScript", "PostgreSQL", "Go"],
            rawExtractedYoe: 5
        )
        cv = document
        return document
    }

    func getCv() async throws -> CvDocument {
        guard let cv else {
            throw APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "No CV"))
        }
        return cv
    }

    func getFeed(limit: Int) async throws -> JobFeedPage {
        JobFeedPage(items: Array(postings.prefix(limit)), exhausted: postings.count <= limit)
    }

    func swipe(jobId: String, direction: SwipeDirection) async throws -> SwipeResult {
        guard let posting = postings.first(where: { $0.id == jobId }) else {
            throw APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "No such job"))
        }
        postings.removeAll { $0.id == jobId }
        guard direction == .right else {
            return SwipeResult(interactionId: "i-\(jobId)", direction: .left, application: nil)
        }

        let application = Application(
            id: "app-\(jobId)",
            jobPostingId: posting.id,
            jobTitle: posting.title,
            employer: posting.employer,
            submissionMode: profile.submissionMode,
            applyRoute: posting.applyRoute,
            status: .awaitingReview,
            employerApplyUrl: "https://example.test/apply/\(jobId)",
            answerSheet: [
                ProposedAnswer(fieldId: "why", label: "Why this role?", answer: "Five years on payment-scale backends in TypeScript and Go.", source: .generated),
                ProposedAnswer(fieldId: "email", label: "Email", answer: profile.email, source: .profile),
            ],
            pendingQuestions: [
                ApplicationQuestion(id: "q-\(jobId)", questionText: "期望薪資 (Expected salary)", isSensitive: true),
            ]
        )
        applications.insert(application, at: 0)
        histories[application.id] = [
            ApplicationStatusEvent(status: .queued, occurredAt: .now.addingTimeInterval(-60)),
            ApplicationStatusEvent(status: .awaitingReview, occurredAt: .now),
        ]
        profile = UserProfile(
            id: profile.id, email: profile.email, yoe: profile.yoe, keywords: profile.keywords,
            submissionMode: profile.submissionMode, markets: profile.markets,
            preferredLanguage: profile.preferredLanguage, dailySubmissionCap: profile.dailySubmissionCap,
            submissionsUsedToday: (profile.submissionsUsedToday ?? 0) + 1
        )
        return SwipeResult(interactionId: "i-\(jobId)", direction: .right, application: application)
    }

    func getApplications(statuses: [ApplicationStatus]) async throws -> [Application] {
        statuses.isEmpty ? applications : applications.filter { statuses.contains($0.status) }
    }

    func getApplication(id: String) async throws -> ApplicationDetail {
        guard let application = applications.first(where: { $0.id == id }) else {
            throw APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "No such application"))
        }
        return ApplicationDetail(application: application, statusHistory: histories[id] ?? [])
    }

    func confirmApplication(id: String, editedAnswers: [EditedAnswer]) async throws -> Application {
        try transition(id, to: .handedOff)
    }

    func reportStatus(applicationId: String, status: ApplicationStatus, note: String?) async throws -> Application {
        try transition(applicationId, to: status, note: note)
    }

    func markHandoffComplete(applicationId: String) async throws -> Application {
        try transition(applicationId, to: .applied)
    }

    func answerQuestion(applicationId: String, questionId: String, answer: String, allowReuse: Bool) async throws -> Application {
        guard let index = applications.firstIndex(where: { $0.id == applicationId }) else {
            throw APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "No such application"))
        }
        let existing = applications[index]
        applications[index] = rebuild(existing, status: existing.status, questions: existing.pendingQuestions.filter { $0.id != questionId })
        return applications[index]
    }

    private func transition(_ id: String, to status: ApplicationStatus, note: String? = nil) throws -> Application {
        guard let index = applications.firstIndex(where: { $0.id == id }) else {
            throw APIClientError.server(status: 404, body: APIErrorBody(code: "not_found", message: "No such application"))
        }
        applications[index] = rebuild(applications[index], status: status, questions: applications[index].pendingQuestions)
        histories[id, default: []].append(ApplicationStatusEvent(status: status, occurredAt: .now, note: note))
        return applications[index]
    }

    private func rebuild(_ application: Application, status: ApplicationStatus, questions: [ApplicationQuestion]) -> Application {
        Application(
            id: application.id,
            jobPostingId: application.jobPostingId,
            jobTitle: application.jobTitle,
            employer: application.employer,
            submissionMode: application.submissionMode,
            applyRoute: application.applyRoute,
            status: status,
            failureReason: application.failureReason,
            lastAttemptRef: application.lastAttemptRef,
            employerApplyUrl: application.employerApplyUrl,
            submittedAt: application.submittedAt,
            answerSheet: application.answerSheet,
            pendingQuestions: questions
        )
    }
}
#endif
