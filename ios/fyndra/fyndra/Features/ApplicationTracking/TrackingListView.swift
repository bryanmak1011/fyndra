import SwiftUI
import FyndraCore

struct TrackingListView: View {
    let session: AppSession
    @State private var model: TrackingViewModel

    init(session: AppSession) {
        self.session = session
        _model = State(initialValue: TrackingViewModel(session: session))
    }

    var body: some View {
        NavigationStack {
            content
                .navigationTitle(Text("Applications"))
                .background(Tokens.Palette.canvas)
        }
        .task { await model.load() }
        .badge(model.actionableCount)
    }

    @ViewBuilder
    private var content: some View {
        switch model.state {
        case .loading:
            ProgressView { Text("Loading…") }.frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            StatusPlaceholder(
                systemImage: "exclamationmark.triangle",
                title: "Something went wrong",
                message: LocalizedStringKey(message),
                actionTitle: "Try again",
                action: { Task { await model.load() } }
            )
        case .empty:
            StatusPlaceholder(
                systemImage: "tray",
                title: "No applications yet",
                message: "Swipe right on a job and it will show up here."
            )
            .accessibilityIdentifier("tracking.empty")
        case .loaded(let applications):
            List(applications) { application in
                NavigationLink {
                    ApplicationDetailView(applicationId: application.id, session: session) { updated in
                        model.replace(updated)
                    }
                } label: {
                    TrackingRow(application: application)
                }
            }
            .listStyle(.insetGrouped)
            .refreshable { await model.load() }
            .accessibilityIdentifier("tracking.list")
        }
    }
}

struct TrackingRow: View {
    let application: Application

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                    Text(application.jobTitle ?? application.id)
                        .font(Tokens.Typography.cardSubtitle)
                        .fixedSize(horizontal: false, vertical: true)
                    if let employer = application.employer {
                        Text(employer)
                            .font(Tokens.Typography.caption)
                            .foregroundStyle(Tokens.Palette.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                Spacer(minLength: Tokens.Spacing.sm)
                if application.status.needsUserAction {
                    Text("Needs you")
                        .font(Tokens.Typography.caption.weight(.semibold))
                        .padding(.horizontal, Tokens.Spacing.sm)
                        .padding(.vertical, Tokens.Spacing.xs)
                        .background(Tokens.Palette.attention.opacity(0.16))
                        .foregroundStyle(Tokens.Palette.attention)
                        .clipShape(Capsule())
                }
            }
            StatusBadge(status: application.status)
        }
        .padding(.vertical, Tokens.Spacing.xs)
        .accessibilityElement(children: .combine)
    }
}
