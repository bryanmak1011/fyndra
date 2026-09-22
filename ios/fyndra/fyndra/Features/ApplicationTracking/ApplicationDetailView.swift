import SwiftUI
import FyndraCore

/// T081 + T071 + T072 in one screen: the answer sheet, the questions only
/// the user can answer, the handoff action, and the status timeline. They
/// are one screen because they are one application — splitting them would
/// make the user navigate to find out why nothing is progressing.
struct ApplicationDetailView: View {
    @State private var model: ApplicationDetailViewModel
    @State private var editedAnswers: [String: String] = [:]
    @State private var statusNote = ""
    @State private var pendingStatus: ApplicationStatus?
    @Environment(\.openURL) private var openURL

    private let onChange: (Application) -> Void

    init(applicationId: String, session: AppSession, onChange: @escaping (Application) -> Void) {
        _model = State(initialValue: ApplicationDetailViewModel(applicationId: applicationId, session: session))
        self.onChange = onChange
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                ProgressView { Text("Loading…") }.frame(maxWidth: .infinity, maxHeight: .infinity)
            case .empty:
                StatusPlaceholder(
                    systemImage: "tray",
                    title: "No applications yet",
                    message: "Swipe right on a job and it will show up here."
                )
            case .failed(let message):
                StatusPlaceholder(
                    systemImage: "exclamationmark.triangle",
                    title: "Something went wrong",
                    message: LocalizedStringKey(message),
                    actionTitle: "Try again",
                    action: { Task { await model.load() } }
                )
            case .loaded(let detail):
                detailBody(detail)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await model.load()
            if let application = model.state.value?.application { onChange(application) }
        }
        .alert(
            Text("Something went wrong"),
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("Done", role: .cancel) { model.errorMessage = nil }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private func detailBody(_ detail: ApplicationDetail) -> some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                    Text(detail.application.jobTitle ?? detail.application.id)
                        .font(Tokens.Typography.cardTitle)
                        .fixedSize(horizontal: false, vertical: true)
                    if let employer = detail.application.employer {
                        Text(employer)
                            .font(Tokens.Typography.cardSubtitle)
                            .foregroundStyle(Tokens.Palette.secondaryText)
                    }
                    StatusBadge(status: detail.application.status)
                    if let reason = detail.application.failureReason {
                        Label(reason, systemImage: "exclamationmark.triangle")
                            .font(Tokens.Typography.caption)
                            .foregroundStyle(Tokens.Palette.dismissive)
                    }
                }
                .padding(.vertical, Tokens.Spacing.xs)
            }

            pendingQuestionsSection(detail)
            answerSheetSection(detail)
            handoffSection(detail)
            statusSection(detail)
            timelineSection(detail)
        }
        .listStyle(.insetGrouped)
        .accessibilityIdentifier("applicationDetail")
    }

    // MARK: - T072: questions only the user can answer

    @ViewBuilder
    private func pendingQuestionsSection(_ detail: ApplicationDetail) -> some View {
        if !detail.application.pendingQuestions.isEmpty {
            Section(header: Text("Questions for you")) {
                ForEach(detail.application.pendingQuestions) { question in
                    PendingQuestionRow(question: question) { text, allowReuse in
                        Task {
                            await model.answer(question: question, text: text, allowReuse: allowReuse)
                            if let application = model.state.value?.application { onChange(application) }
                        }
                    }
                }
            }
        }
    }

    // MARK: - T071: the answer sheet

    @ViewBuilder
    private func answerSheetSection(_ detail: ApplicationDetail) -> some View {
        if !detail.application.answerSheet.isEmpty {
            Section(header: Text("Answer sheet")) {
                ForEach(detail.application.answerSheet) { proposed in
                    VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                        Text(proposed.label)
                            .font(Tokens.Typography.sectionHeader)
                        TextField(
                            "Your answer",
                            text: Binding(
                                get: { editedAnswers[proposed.fieldId] ?? proposed.answer },
                                set: { editedAnswers[proposed.fieldId] = $0 }
                            ),
                            axis: .vertical
                        )
                        .textFieldStyle(.plain)
                        .lineLimit(1...6)
                        Text(proposed.source.displayName)
                            .font(Tokens.Typography.caption)
                            .foregroundStyle(Tokens.Palette.secondaryText)
                    }
                    .padding(.vertical, Tokens.Spacing.xs)
                }

                if detail.application.status == .awaitingReview {
                    Button {
                        let edits = editedAnswers.map { EditedAnswer(fieldId: $0.key, answer: $0.value) }
                        Task {
                            await model.confirm(editedAnswers: edits)
                            if let application = model.state.value?.application { onChange(application) }
                        }
                    } label: {
                        Text("Confirm and send").frame(maxWidth: .infinity).minimumTapTarget()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isSubmitting)
                    .accessibilityIdentifier("applicationDetail.confirm")
                }
            }
        }
    }

    // MARK: - FR-025: handoff

    @ViewBuilder
    private func handoffSection(_ detail: ApplicationDetail) -> some View {
        if let urlString = detail.application.employerApplyUrl, let url = URL(string: urlString) {
            Section {
                Button {
                    openURL(url)
                } label: {
                    Label("Open the employer's form", systemImage: "arrow.up.forward.square")
                        .minimumTapTarget()
                }
                if detail.application.status == .handedOff {
                    Button {
                        Task {
                            await model.markHandoffComplete()
                            if let application = model.state.value?.application { onChange(application) }
                        }
                    } label: {
                        Label("I have submitted this myself", systemImage: "checkmark")
                            .minimumTapTarget()
                    }
                    .disabled(model.isSubmitting)
                    .accessibilityIdentifier("applicationDetail.handoffComplete")
                }
            }
        }
    }

    // MARK: - FR-011a: user-reported progression

    @ViewBuilder
    private func statusSection(_ detail: ApplicationDetail) -> some View {
        if !model.offerableStatuses.isEmpty {
            Section(header: Text("Update status")) {
                Picker(selection: $pendingStatus) {
                    Text("Update status").tag(ApplicationStatus?.none)
                    ForEach(model.offerableStatuses, id: \.self) { status in
                        Text(status.displayName).tag(ApplicationStatus?.some(status))
                    }
                } label: {
                    Text("Update status")
                }
                .accessibilityIdentifier("applicationDetail.statusPicker")

                if let pendingStatus {
                    TextField("Your answer", text: $statusNote, axis: .vertical)
                        .lineLimit(1...4)
                    Button {
                        Task {
                            await model.report(pendingStatus, note: statusNote.isEmpty ? nil : statusNote)
                            self.pendingStatus = nil
                            statusNote = ""
                            if let application = model.state.value?.application { onChange(application) }
                        }
                    } label: {
                        Text("Save").frame(maxWidth: .infinity).minimumTapTarget()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isSubmitting)
                    .accessibilityIdentifier("applicationDetail.saveStatus")
                }
            }
        }
    }

    private func timelineSection(_ detail: ApplicationDetail) -> some View {
        Section(header: Text("Timeline")) {
            ForEach(Array(detail.statusHistory.enumerated()), id: \.offset) { _, event in
                HStack(alignment: .top, spacing: Tokens.Spacing.md) {
                    Image(systemName: event.status.systemImage)
                        .foregroundStyle(event.status.tint)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                        Text(event.status.displayName)
                        Text(event.occurredAt.formatted(date: .abbreviated, time: .shortened))
                            .font(Tokens.Typography.caption)
                            .foregroundStyle(Tokens.Palette.secondaryText)
                        if let note = event.note, !note.isEmpty {
                            Text(note).font(Tokens.Typography.caption)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

/// T072. A sensitive question has to explain itself: the user is being asked
/// to do work the app deliberately refuses to do for them, and without the
/// reason that reads as the app being broken.
struct PendingQuestionRow: View {
    let question: ApplicationQuestion
    let onAnswer: (String, Bool) -> Void

    @State private var text = ""
    @State private var allowReuse = false

    var body: some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
            Text(question.questionText)
                .font(Tokens.Typography.sectionHeader)
                .fixedSize(horizontal: false, vertical: true)

            if question.isSensitive {
                VStack(alignment: .leading, spacing: Tokens.Spacing.xs) {
                    Label("Only you can answer this", systemImage: "hand.raised.fill")
                        .font(Tokens.Typography.caption.weight(.semibold))
                        .foregroundStyle(Tokens.Palette.attention)
                    // The literal is the String Catalog key, so it cannot be
                    // wrapped or split without orphaning the zh-Hant entry.
                    // swiftlint:disable:next line_length
                    Text("This asks about work authorisation, visa status, an identity number, expected salary, or personal characteristics. Fyndra never answers these for you, and never reuses your answer on another application.")
                        .font(Tokens.Typography.caption)
                        .foregroundStyle(Tokens.Palette.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(Tokens.Spacing.sm)
                .background(Tokens.Palette.attention.opacity(0.10))
                .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.control))
                .accessibilityElement(children: .combine)
            }

            TextField("Your answer", text: $text, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .lineLimit(1...5)
                .accessibilityIdentifier("question.answerField")

            // FR-022: reuse is not offered at all for a sensitive question,
            // rather than offered and then quietly ignored server-side.
            if !question.isSensitive {
                Toggle("Save this answer for future applications", isOn: $allowReuse)
                    .font(Tokens.Typography.caption)
            }

            Button {
                onAnswer(text, allowReuse)
                text = ""
            } label: {
                Text("Send answer").frame(maxWidth: .infinity).minimumTapTarget()
            }
            .buttonStyle(.bordered)
            .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityIdentifier("question.send")
        }
        .padding(.vertical, Tokens.Spacing.xs)
    }
}
