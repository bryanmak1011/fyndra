import Foundation

/// FR-018/FR-019: default is `.reviewBeforeSending`; the user opts into
/// `.autoSubmit` explicitly in Settings.
public enum SubmissionMode: String, Codable, Sendable {
    case reviewBeforeSending = "review_before_sending"
    case autoSubmit = "auto_submit"
}

public enum Market: String, Codable, Sendable {
    case hongKong = "HK"
    case taiwan = "TW"
}

/// The contract spells this `zh-Hant`, which isn't a legal Swift
/// identifier — hence the explicit raw values instead of a bare `zh_Hant`
/// case name leaking into JSON.
public enum AppLanguage: String, Codable, Sendable {
    case zhHant = "zh-Hant"
    case en = "en"
}

/// Mirrors `UserProfile` in contracts/openapi.yaml.
public struct UserProfile: Codable, Sendable, Equatable {
    public let id: String
    public let email: String
    public let yoe: Int?
    public let keywords: [String]
    public let submissionMode: SubmissionMode
    public let markets: [Market]
    public let preferredLanguage: AppLanguage
    public let dailySubmissionCap: Int
    public let submissionsUsedToday: Int?

    public init(
        id: String,
        email: String,
        yoe: Int?,
        keywords: [String],
        submissionMode: SubmissionMode,
        markets: [Market],
        preferredLanguage: AppLanguage,
        dailySubmissionCap: Int,
        submissionsUsedToday: Int? = nil
    ) {
        self.id = id
        self.email = email
        self.yoe = yoe
        self.keywords = keywords
        self.submissionMode = submissionMode
        self.markets = markets
        self.preferredLanguage = preferredLanguage
        self.dailySubmissionCap = dailySubmissionCap
        self.submissionsUsedToday = submissionsUsedToday
    }
}

/// The body `POST /auth/request-code` returns.
///
/// `session` is present only for an account the server has been configured
/// to let skip one-time-code verification — a non-production test account
/// (see the API's `AUTH_BYPASS_EMAILS`). For everyone else this decodes as
/// an empty object, and the client must go on to the code step. Optional
/// rather than a separate endpoint so an ordinary caller cannot tell the
/// two cases apart by anything other than the absence of a session.
public struct LoginCodeResponse: Codable, Sendable, Equatable {
    public let session: AuthResponse?

    public init(session: AuthResponse? = nil) {
        self.session = session
    }
}

/// The body `POST /auth/verify` returns.
public struct AuthResponse: Codable, Sendable, Equatable {
    public let token: String
    public let expiresAt: Date
    public let profile: UserProfile

    public init(token: String, expiresAt: Date, profile: UserProfile) {
        self.token = token
        self.expiresAt = expiresAt
        self.profile = profile
    }
}
