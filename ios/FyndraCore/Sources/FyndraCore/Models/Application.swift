import Foundation

/// Mirrors `ApplicationStatus` in contracts/openapi.yaml. The first five
/// are system-owned pre-submission states; the rest the user reports
/// themselves (FR-011a), because employers answer outside the app.
public enum ApplicationStatus: String, Codable, Sendable, CaseIterable {
    case queued
    case awaitingReview = "awaiting_review"
    case pendingNeedsAnswer = "pending_needs_answer"
    case handedOff = "handed_off"
    case needsAttention = "needs_attention"
    case applied
    case responded
    case interview
    case offer
    case hired
    case rejected
    case withdrawn

    /// The states the user may move an application into themselves. The
    /// server is the authority (it re-validates every transition); this
    /// exists so the UI never offers a control that can only 409.
    public static let userReportable: [ApplicationStatus] = [
        .responded, .interview, .offer, .hired, .rejected, .withdrawn,
    ]

    /// Nothing follows a terminal state, so the detail screen hides its
    /// status control rather than showing one that always fails.
    public var isTerminal: Bool {
        switch self {
        case .hired, .rejected, .withdrawn: true
        default: false
        }
    }

    /// True while the application is the system's to move — the user can
    /// look, but the only actions available are the ones the app offers
    /// explicitly (confirm, answer a question, mark a handoff done).
    public var isPreSubmission: Bool {
        switch self {
        case .queued, .awaitingReview, .pendingNeedsAnswer, .needsAttention: true
        default: false
        }
    }

    /// Whether this status needs the user to do something before anything
    /// else can happen — drives the badge on the tracking list.
    public var needsUserAction: Bool {
        switch self {
        case .awaitingReview, .pendingNeedsAnswer, .needsAttention, .handedOff: true
        default: false
        }
    }
}

/// Where a proposed answer came from. Surfaced per-field in the review UI
/// so the user can see what was generated versus taken from their profile
/// (FR-008) — an LLM draft deserves more scrutiny than a copied email.
public enum AnswerSource: String, Codable, Sendable {
    case profile
    case cv
    case reusedAnswer = "reused_answer"
    case generated
}

public struct ProposedAnswer: Codable, Sendable, Equatable, Identifiable {
    public let fieldId: String
    public let label: String
    public let answer: String
    public let source: AnswerSource
    public let editedByUser: Bool?

    public var id: String { fieldId }

    public init(fieldId: String, label: String, answer: String, source: AnswerSource, editedByUser: Bool? = nil) {
        self.fieldId = fieldId
        self.label = label
        self.answer = answer
        self.source = source
        self.editedByUser = editedByUser
    }
}

/// A question the server refuses to answer on the user's behalf. When
/// `isSensitive` the client must say *why* it is asking (FR-022) rather
/// than presenting it as an ordinary blank field.
public struct ApplicationQuestion: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let questionText: String
    public let isSensitive: Bool
    public let answer: String?

    public init(id: String, questionText: String, isSensitive: Bool, answer: String? = nil) {
        self.id = id
        self.questionText = questionText
        self.isSensitive = isSensitive
        self.answer = answer
    }
}

public struct ApplicationStatusEvent: Codable, Sendable, Equatable {
    public let status: ApplicationStatus
    public let occurredAt: Date
    public let note: String?

    public init(status: ApplicationStatus, occurredAt: Date, note: String? = nil) {
        self.status = status
        self.occurredAt = occurredAt
        self.note = note
    }
}

/// Mirrors `Application` in contracts/openapi.yaml.
///
/// `jobPostingId`, `jobTitle` and `employer` decode as optional even though
/// the contract lists them: they are cheap to omit server-side and a
/// tracking row that renders "Job no longer available" is far better than a
/// whole list that fails to decode.
public struct Application: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let jobPostingId: String?
    public let jobTitle: String?
    public let employer: String?
    public let submissionMode: SubmissionMode
    public let applyRoute: ApplyRoute
    public let status: ApplicationStatus
    public let failureReason: String?
    public let lastAttemptRef: String?
    public let employerApplyUrl: String?
    public let submittedAt: Date?
    public let answerSheet: [ProposedAnswer]
    public let pendingQuestions: [ApplicationQuestion]

    public init(
        id: String,
        jobPostingId: String? = nil,
        jobTitle: String? = nil,
        employer: String? = nil,
        submissionMode: SubmissionMode,
        applyRoute: ApplyRoute,
        status: ApplicationStatus,
        failureReason: String? = nil,
        lastAttemptRef: String? = nil,
        employerApplyUrl: String? = nil,
        submittedAt: Date? = nil,
        answerSheet: [ProposedAnswer] = [],
        pendingQuestions: [ApplicationQuestion] = []
    ) {
        self.id = id
        self.jobPostingId = jobPostingId
        self.jobTitle = jobTitle
        self.employer = employer
        self.submissionMode = submissionMode
        self.applyRoute = applyRoute
        self.status = status
        self.failureReason = failureReason
        self.lastAttemptRef = lastAttemptRef
        self.employerApplyUrl = employerApplyUrl
        self.submittedAt = submittedAt
        self.answerSheet = answerSheet
        self.pendingQuestions = pendingQuestions
    }

    /// `answerSheet`/`pendingQuestions` are absent from some server
    /// responses (the swipe result, for one) rather than empty arrays.
    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        jobPostingId = try c.decodeIfPresent(String.self, forKey: .jobPostingId)
        jobTitle = try c.decodeIfPresent(String.self, forKey: .jobTitle)
        employer = try c.decodeIfPresent(String.self, forKey: .employer)
        submissionMode = try c.decode(SubmissionMode.self, forKey: .submissionMode)
        applyRoute = try c.decode(ApplyRoute.self, forKey: .applyRoute)
        status = try c.decode(ApplicationStatus.self, forKey: .status)
        failureReason = try c.decodeIfPresent(String.self, forKey: .failureReason)
        lastAttemptRef = try c.decodeIfPresent(String.self, forKey: .lastAttemptRef)
        employerApplyUrl = try c.decodeIfPresent(String.self, forKey: .employerApplyUrl)
        submittedAt = try c.decodeIfPresent(Date.self, forKey: .submittedAt)
        answerSheet = try c.decodeIfPresent([ProposedAnswer].self, forKey: .answerSheet) ?? []
        pendingQuestions = try c.decodeIfPresent([ApplicationQuestion].self, forKey: .pendingQuestions) ?? []
    }
}

/// `GET /applications/{id}` — an `Application` plus its status history.
/// Flattened rather than nested because the contract composes it with
/// `allOf`, which is a flat JSON object on the wire.
public struct ApplicationDetail: Codable, Sendable, Equatable, Identifiable {
    public let application: Application
    public let statusHistory: [ApplicationStatusEvent]

    public var id: String { application.id }

    public init(application: Application, statusHistory: [ApplicationStatusEvent]) {
        self.application = application
        self.statusHistory = statusHistory
    }

    private enum CodingKeys: String, CodingKey {
        case statusHistory
    }

    public init(from decoder: Decoder) throws {
        application = try Application(from: decoder)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        statusHistory = try c.decodeIfPresent([ApplicationStatusEvent].self, forKey: .statusHistory) ?? []
    }

    public func encode(to encoder: Encoder) throws {
        try application.encode(to: encoder)
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(statusHistory, forKey: .statusHistory)
    }
}
