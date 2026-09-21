import Foundation

/// Whether the server can submit this posting for the user or has to hand
/// it back to them (FR-009). Today every route resolves to `.handoff` —
/// see the API's `sourcing/apply-route.ts` — but the client renders both,
/// because the distinction is the user-visible promise the card makes.
public enum ApplyRoute: String, Codable, Sendable {
    case directSubmitAllowlisted = "direct_submit_allowlisted"
    case handoff
}

/// Mirrors `JobPosting` in contracts/openapi.yaml. `matchScore` is this
/// user's per-profile FeedEntry score, not a property of the posting.
public struct JobPosting: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let sourceProvider: String
    public let employerApplyUrl: String?
    public let title: String
    public let employer: String
    public let requirementsSummary: String
    public let language: DetectedLanguage
    public let market: Market
    public let applyRoute: ApplyRoute
    public let matchScore: Double

    public init(
        id: String,
        sourceProvider: String,
        employerApplyUrl: String? = nil,
        title: String,
        employer: String,
        requirementsSummary: String,
        language: DetectedLanguage,
        market: Market,
        applyRoute: ApplyRoute,
        matchScore: Double
    ) {
        self.id = id
        self.sourceProvider = sourceProvider
        self.employerApplyUrl = employerApplyUrl
        self.title = title
        self.employer = employer
        self.requirementsSummary = requirementsSummary
        self.language = language
        self.market = market
        self.applyRoute = applyRoute
        self.matchScore = matchScore
    }

    /// `matchScore` is a ranking score, not a fraction: the server weights a
    /// title-token hit double (api/src/matching/rank.ts), so a very strong
    /// match exceeds 1.0 and rendering it raw produced "120% match" on a
    /// real feed. Clamped here rather than in a view, so every surface that
    /// shows a percentage shows the same one.
    public var matchPercentage: Int {
        Int((min(max(matchScore, 0), 1) * 100).rounded())
    }
}

/// `GET /jobs/feed`. `exhausted` drives the end-of-feed state (FR-004a) and
/// is not an error condition — an empty page with `exhausted == false` just
/// means this batch had nothing left after filtering.
public struct JobFeedPage: Codable, Sendable, Equatable {
    public let items: [JobPosting]
    public let exhausted: Bool

    public init(items: [JobPosting], exhausted: Bool) {
        self.items = items
        self.exhausted = exhausted
    }
}

public enum SwipeDirection: String, Codable, Sendable {
    case left
    case right
}

/// `POST /jobs/{jobId}/swipe`. A left swipe carries no application; a right
/// swipe carries one in `queued`, which the client shows immediately rather
/// than waiting for the worker.
public struct SwipeResult: Codable, Sendable, Equatable {
    public let interactionId: String
    public let direction: SwipeDirection
    public let application: Application?

    public init(interactionId: String, direction: SwipeDirection, application: Application? = nil) {
        self.interactionId = interactionId
        self.direction = direction
        self.application = application
    }
}
