import SwiftUI
import FyndraCore

struct JobFeedView: View {
    let session: AppSession
    @State private var model: JobFeedViewModel
    /// The contextual push prompt (T082) fires on the first right swipe,
    /// not at launch — a permission asked before the user knows why is the
    /// one people deny (constitution V).
    @State private var pushPrompt = PushPermission()

    init(session: AppSession) {
        self.session = session
        _model = State(initialValue: JobFeedViewModel(session: session))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(Text("Jobs"))
                .background(Tokens.Palette.canvas)
                .toolbar {
                    if let profile = session.profile {
                        ToolbarItem(placement: .topBarTrailing) {
                            Text("\(profile.submissionsUsedToday ?? 0) of \(profile.dailySubmissionCap) used today")
                                .font(Tokens.Typography.caption)
                                .foregroundStyle(Tokens.Palette.secondaryText)
                                .monospacedDigit()
                                .accessibilityIdentifier("feed.capCounter")
                        }
                    }
                }
        }
        .task { await model.load() }
        .alert(
            Text("Something went wrong"),
            isPresented: Binding(
                get: { model.swipeRejection != nil },
                set: { if !$0 { model.swipeRejection = nil } }
            )
        ) {
            Button("Done", role: .cancel) { model.swipeRejection = nil }
        } message: {
            Text(model.swipeRejection ?? "")
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView { Text("Finding jobs for you…") }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            StatusPlaceholder(
                systemImage: "exclamationmark.triangle",
                title: "Something went wrong",
                message: LocalizedStringKey(message),
                actionTitle: "Try again",
                action: { Task { await model.load() } }
            )
        case .empty:
            endOfFeed
        case .loaded(let cards):
            deck(cards)
        }
    }

    /// T056. Two different situations share this screen and must not read
    /// the same: the server saying there is genuinely nothing left, versus
    /// this batch running out with more behind it.
    private var endOfFeed: some View {
        StatusPlaceholder(
            systemImage: model.exhausted ? "checkmark.circle" : "arrow.clockwise",
            title: "No more matches",
            message:
                "You have seen every job that matches your profile right now. Broaden your criteria, or check back after the next crawl.",
            actionTitle: model.exhausted ? "Broaden my criteria" : "Reload feed",
            action: { Task { await model.load() } }
        )
        .accessibilityIdentifier("feed.endOfFeed")
    }

    private func deck(_ cards: [JobPosting]) -> some View {
        VStack(spacing: Tokens.Spacing.lg) {
            ZStack {
                // Only the top three are rendered: the ones below are never
                // visible, and keeping the whole page alive would cost
                // layout on every drag frame.
                ForEach(Array(cards.prefix(3).enumerated()).reversed(), id: \.element.id) { index, posting in
                    SwipeCardView(posting: posting, isTop: index == 0) { direction in
                        if direction == .right { pushPrompt.requestIfNeeded(session: session) }
                        model.swipe(posting, direction: direction)
                    }
                    .scaleEffect(1 - CGFloat(index) * 0.04)
                    .offset(y: CGFloat(index) * 10)
                    .zIndex(Double(cards.count - index))
                    .allowsHitTesting(index == 0)
                }
            }
            .padding(.horizontal, Tokens.Spacing.md)

            decisionButtons(for: cards[0])
        }
        .padding(.bottom, Tokens.Spacing.lg)
    }

    /// The same two decisions as the gesture, as buttons — a swipe is not
    /// reachable one-handed for everyone, and it is not discoverable at all
    /// on first launch.
    private func decisionButtons(for posting: JobPosting) -> some View {
        HStack(spacing: Tokens.Spacing.xl) {
            decisionButton(
                systemImage: "xmark",
                tint: Tokens.Palette.dismissive,
                label: "Pass",
                identifier: "feed.pass"
            ) {
                model.swipe(posting, direction: .left)
            }

            decisionButton(
                systemImage: "checkmark",
                tint: Tokens.Palette.affirmative,
                label: "Apply",
                identifier: "feed.apply"
            ) {
                pushPrompt.requestIfNeeded(session: session)
                model.swipe(posting, direction: .right)
            }
        }
    }

    private func decisionButton(
        systemImage: String,
        tint: Color,
        label: LocalizedStringKey,
        identifier: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.title2.weight(.bold))
                .foregroundStyle(tint)
                .frame(width: Tokens.Size.swipeActionButton, height: Tokens.Size.swipeActionButton)
                .background(Tokens.Palette.surface, in: Circle())
                .shadow(color: .black.opacity(0.1), radius: 6, y: 2)
        }
        .accessibilityLabel(label)
        .accessibilityIdentifier(identifier)
    }
}
