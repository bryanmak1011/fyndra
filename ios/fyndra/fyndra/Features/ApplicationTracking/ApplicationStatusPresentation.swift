import SwiftUI
import FyndraCore

/// The one place that decides how a status looks and reads. Statuses appear
/// on the tracking list, the detail timeline and the status picker, and
/// three separate switch statements would drift apart.
extension ApplicationStatus {
    var displayName: LocalizedStringKey {
        switch self {
        case .queued: "Queued"
        case .awaitingReview: "Awaiting your review"
        case .pendingNeedsAnswer: "Needs an answer"
        case .handedOff: "Handed off to you"
        case .needsAttention: "Needs attention"
        case .applied: "Applied"
        case .responded: "Employer responded"
        case .interview: "Interview"
        case .offer: "Offer"
        case .hired: "Hired"
        case .rejected: "Rejected"
        case .withdrawn: "Withdrawn"
        }
    }

    var tint: Color {
        switch self {
        case .needsAttention, .pendingNeedsAnswer, .awaitingReview, .handedOff:
            Tokens.Palette.attention
        case .hired, .offer:
            Tokens.Palette.affirmative
        case .rejected, .withdrawn:
            Tokens.Palette.dismissive
        default:
            Tokens.Palette.secondaryText
        }
    }

    var systemImage: String {
        switch self {
        case .queued: "clock"
        case .awaitingReview: "doc.text.magnifyingglass"
        case .pendingNeedsAnswer: "questionmark.circle"
        case .handedOff: "arrow.up.forward.square"
        case .needsAttention: "exclamationmark.triangle"
        case .applied: "paperplane.fill"
        case .responded: "envelope.open"
        case .interview: "person.2"
        case .offer: "sparkles"
        case .hired: "checkmark.seal.fill"
        case .rejected: "xmark.circle"
        case .withdrawn: "arrow.uturn.backward"
        }
    }
}

extension AnswerSource {
    /// FR-008: the user needs to know which answers were drafted for them,
    /// because those are the ones worth reading closely.
    var displayName: LocalizedStringKey {
        switch self {
        case .profile: "Source: profile"
        case .cv: "Source: CV"
        case .reusedAnswer: "Source: a previous answer"
        case .generated: "Source: drafted for you"
        }
    }
}

/// A small status pill, used on list rows and the detail header.
struct StatusBadge: View {
    let status: ApplicationStatus

    var body: some View {
        Label(status.displayName, systemImage: status.systemImage)
            .font(Tokens.Typography.caption)
            .padding(.horizontal, Tokens.Spacing.sm)
            .padding(.vertical, Tokens.Spacing.xs)
            .foregroundStyle(status.tint)
            .background(status.tint.opacity(0.12))
            .clipShape(Capsule())
    }
}
