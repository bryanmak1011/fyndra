import SwiftUI
import FyndraCore

/// One job card. Pure presentation plus the drag gesture — the decision of
/// what a swipe *means* lives in `JobFeedViewModel`.
struct SwipeCardView: View {
    let posting: JobPosting
    let isTop: Bool
    let onSwipe: (SwipeDirection) -> Void

    @State private var offset: CGSize = .zero
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// How far the card must travel before letting go commits the swipe.
    private let commitDistance: CGFloat = 110

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.md) {
            header
            Text(posting.requirementsSummary)
                .font(Tokens.Typography.body)
                .foregroundStyle(Tokens.Palette.secondaryText)
                .lineLimit(8)
            Spacer(minLength: 0)
            footer
        }
        .padding(Tokens.Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .fyndraCard()
        .overlay(alignment: .topTrailing) { decisionStamp }
        .offset(offset)
        .rotationEffect(.degrees(Double(offset.width / 22)))
        .gesture(isTop ? dragGesture : nil)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(posting.title), \(posting.employer)")
        .accessibilityValue(Text("\(posting.matchPercentage)% match"))
        .accessibilityIdentifier(isTop ? "feed.card.top" : "feed.card")
        // VoiceOver cannot drag a card, so the same two decisions are
        // reachable as actions (constitution III).
        .accessibilityAction(named: Text("Apply")) { commit(.right) }
        .accessibilityAction(named: Text("Pass")) { commit(.left) }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
            HStack(alignment: .firstTextBaseline) {
                Text(marketLabel)
                    .font(Tokens.Typography.caption)
                    .padding(.horizontal, Tokens.Spacing.sm)
                    .padding(.vertical, Tokens.Spacing.xs)
                    .background(Tokens.Palette.accent.opacity(0.15))
                    .clipShape(Capsule())
                Spacer()
                Text("\(posting.matchPercentage)% match")
                    .font(Tokens.Typography.caption)
                    .foregroundStyle(Tokens.Palette.secondaryText)
                    .monospacedDigit()
            }
            // zh-Hant titles at the largest Dynamic Type size must wrap
            // rather than truncate (constitution III) — hence no lineLimit.
            Text(posting.title)
                .font(Tokens.Typography.cardTitle)
                .fixedSize(horizontal: false, vertical: true)
            Text(posting.employer)
                .font(Tokens.Typography.cardSubtitle)
                .foregroundStyle(Tokens.Palette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var footer: some View {
        HStack(spacing: Tokens.Spacing.sm) {
            Label(
                posting.applyRoute == .handoff
                    ? String(localized: "Hand off to employer")
                    : String(localized: "Direct submit"),
                systemImage: posting.applyRoute == .handoff ? "arrow.up.forward.square" : "paperplane.fill"
            )
            .font(Tokens.Typography.caption)
            .foregroundStyle(Tokens.Palette.secondaryText)
            Spacer()
            Text(posting.sourceProvider)
                .font(Tokens.Typography.caption)
                .foregroundStyle(Tokens.Palette.secondaryText)
        }
    }

    /// The APPLY/PASS stamp that tracks the drag, so the user can see which
    /// way the card is going before they let go.
    @ViewBuilder
    private var decisionStamp: some View {
        let goingRight = offset.width > 0
        let intensity = min(abs(offset.width) / commitDistance, 1)
        if intensity > 0.15 {
            Text(goingRight ? "Apply" : "Pass")
                .font(.title3.weight(.heavy))
                .padding(.horizontal, Tokens.Spacing.md)
                .padding(.vertical, Tokens.Spacing.sm)
                .foregroundStyle(goingRight ? Tokens.Palette.affirmative : Tokens.Palette.dismissive)
                .overlay(
                    RoundedRectangle(cornerRadius: Tokens.Radius.control)
                        .stroke(goingRight ? Tokens.Palette.affirmative : Tokens.Palette.dismissive, lineWidth: 3)
                )
                .opacity(intensity)
                .padding(Tokens.Spacing.lg)
                .accessibilityHidden(true)
        }
    }

    private var marketLabel: String {
        posting.market == .hongKong ? String(localized: "Hong Kong") : String(localized: "Taiwan")
    }

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { offset = $0.translation }
            .onEnded { value in
                guard abs(value.translation.width) > commitDistance else {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { offset = .zero }
                    return
                }
                commit(value.translation.width > 0 ? .right : .left)
            }
    }

    private func commit(_ direction: SwipeDirection) {
        let flyAway = CGSize(width: direction == .right ? 700 : -700, height: offset.height)
        if reduceMotion {
            offset = .zero
            onSwipe(direction)
        } else {
            withAnimation(.easeOut(duration: 0.22)) { offset = flyAway }
            // Let the card leave the screen before the deck drops it, so
            // the next card does not appear underneath a visible one.
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.22) {
                offset = .zero
                onSwipe(direction)
            }
        }
    }
}
