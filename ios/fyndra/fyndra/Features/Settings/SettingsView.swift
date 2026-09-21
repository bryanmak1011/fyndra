import SwiftUI
import FyndraCore

/// T073. Submission mode is the consequential control here: FR-018/FR-019
/// make review-before-sending the default and auto-submit an *informed*
/// opt-in, so each mode carries its own plain-language consequence rather
/// than a bare toggle label.
struct SettingsView: View {
    let session: AppSession
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                if let profile = session.profile {
                    submissionModeSection(profile)
                    capSection(profile)
                    marketsSection(profile)
                    languageSection(profile)
                    accountSection(profile)
                } else {
                    ProgressView { Text("Loading…") }
                }
            }
            .navigationTitle(Text("Settings"))
            .alert(
                Text("Something went wrong"),
                isPresented: Binding(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })
            ) {
                Button("Done", role: .cancel) { errorMessage = nil }
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .task { await session.refreshProfile() }
    }

    private func submissionModeSection(_ profile: UserProfile) -> some View {
        Section {
            Picker(
                selection: Binding(
                    get: { profile.submissionMode },
                    set: { mode in Task { await update(UserProfileUpdate(submissionMode: mode)) } }
                )
            ) {
                Text("Review before sending").tag(SubmissionMode.reviewBeforeSending)
                Text("Auto-submit").tag(SubmissionMode.autoSubmit)
            } label: {
                Text("Submission mode")
            }
            .pickerStyle(.inline)
            .accessibilityIdentifier("settings.submissionMode")
        } header: {
            Text("Submission mode")
        } footer: {
            Text(
                profile.submissionMode == .autoSubmit
                    ? "Fyndra submits without asking, except for questions only you can answer."
                    : "Fyndra prepares the application and waits for you to confirm it. This is the default."
            )
        }
    }

    private func capSection(_ profile: UserProfile) -> some View {
        Section(header: Text("Daily limit")) {
            LabeledContent {
                Text("\(profile.submissionsUsedToday ?? 0) of \(profile.dailySubmissionCap) used today")
                    .monospacedDigit()
            } label: {
                Text("Daily limit")
            }
            .accessibilityIdentifier("settings.cap")

            Stepper(
                value: Binding(
                    get: { profile.dailySubmissionCap },
                    set: { cap in Task { await update(UserProfileUpdate(dailySubmissionCap: cap)) } }
                ),
                in: 1...50
            ) {
                Text("\(profile.dailySubmissionCap)").monospacedDigit()
            }
            .disabled(isSaving)
        }
    }

    private func marketsSection(_ profile: UserProfile) -> some View {
        Section(header: Text("Markets")) {
            ForEach([Market.hongKong, .taiwan], id: \.self) { market in
                Toggle(
                    market == .hongKong ? "Hong Kong" : "Taiwan",
                    isOn: Binding(
                        get: { profile.markets.contains(market) },
                        set: { isOn in
                            var markets = profile.markets
                            if isOn { markets.append(market) } else { markets.removeAll { $0 == market } }
                            Task { await update(UserProfileUpdate(markets: markets)) }
                        }
                    )
                )
                .disabled(isSaving)
            }
        }
    }

    private func languageSection(_ profile: UserProfile) -> some View {
        Section(header: Text("Language")) {
            Picker(
                selection: Binding(
                    get: { profile.preferredLanguage },
                    set: { language in Task { await update(UserProfileUpdate(preferredLanguage: language)) } }
                )
            ) {
                Text("English").tag(AppLanguage.en)
                Text("Traditional Chinese").tag(AppLanguage.zhHant)
            } label: {
                Text("Language")
            }
            .accessibilityIdentifier("settings.language")
        }
    }

    private func accountSection(_ profile: UserProfile) -> some View {
        Section {
            LabeledContent("Email address", value: profile.email)
            Button(role: .destructive) {
                Task { await session.signOut() }
            } label: {
                Text("Sign out").minimumTapTarget()
            }
            .accessibilityIdentifier("settings.signOut")
        }
    }

    private func update(_ change: UserProfileUpdate) async {
        isSaving = true
        defer { isSaving = false }
        do {
            session.updateProfile(try await session.api.updateProfile(change))
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }
}
