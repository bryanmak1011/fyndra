import SwiftUI
import UniformTypeIdentifiers
import FyndraCore

/// T036 + T037. Upload on top, review-and-edit below — one screen, because
/// the review only makes sense next to the document it came from, and the
/// user arrives here for both reasons.
struct ProfileView: View {
    let session: AppSession
    @State private var model: ProfileViewModel
    @State private var isPickingFile = false

    init(session: AppSession) {
        self.session = session
        _model = State(initialValue: ProfileViewModel(session: session))
    }

    var body: some View {
        NavigationStack {
            List {
                cvSection
                keywordsSection
                experienceSection
                saveSection
            }
            .listStyle(.insetGrouped)
            .navigationTitle(Text("Your profile"))
        }
        .task { await model.load() }
        .onDisappear { model.cancelPolling() }
        .fileImporter(
            isPresented: $isPickingFile,
            // The server accepts exactly these two (api/src/cv/extract.ts);
            // filtering here means the user cannot pick something that is
            // guaranteed to come back as a 422.
            allowedContentTypes: [.pdf, UTType("org.openxmlformats.wordprocessingml.document") ?? .data],
            allowsMultipleSelection: false
        ) { result in
            guard case let .success(urls) = result, let url = urls.first else { return }
            Task { await model.upload(fileURL: url) }
        }
    }

    // MARK: - Upload (T036): loading / empty / error / success all handled

    @ViewBuilder
    private var cvSection: some View {
        Section {
            switch model.uploadState {
            case .uploading, .parsing:
                HStack(spacing: Tokens.Spacing.md) {
                    ProgressView()
                    Text("Reading your CV…")
                }
                .accessibilityIdentifier("profile.parsing")
            case .failed(let message):
                VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                    Label("We could not read that file", systemImage: "exclamationmark.triangle")
                        .font(Tokens.Typography.sectionHeader)
                        .foregroundStyle(Tokens.Palette.dismissive)
                    Text(message)
                        .font(Tokens.Typography.caption)
                        .foregroundStyle(Tokens.Palette.secondaryText)
                        .fixedSize(horizontal: false, vertical: true)
                    chooseFileButton(title: "Try again")
                }
                .accessibilityIdentifier("profile.uploadError")
            case .idle:
                switch model.cvState {
                case .loading:
                    HStack(spacing: Tokens.Spacing.md) {
                        ProgressView()
                        Text("Loading…")
                    }
                case .loaded(let document):
                    loadedCv(document)
                case .empty, .failed:
                    VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
                        Text("No CV uploaded yet").font(Tokens.Typography.sectionHeader)
                        Text("A PDF or Word (.docx) file with selectable text. A scanned or photographed CV cannot be read.")
                            .font(Tokens.Typography.caption)
                            .foregroundStyle(Tokens.Palette.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        chooseFileButton(title: "Choose a file")
                    }
                    .accessibilityIdentifier("profile.noCv")
                }
            }
        } header: {
            Text("Upload your CV")
        }
    }

    private func loadedCv(_ document: CvDocument) -> some View {
        VStack(alignment: .leading, spacing: Tokens.Spacing.sm) {
            Label(
                document.fileFormat.rawValue.uppercased(),
                systemImage: document.parseStatus == .succeeded ? "checkmark.circle.fill" : "exclamationmark.circle"
            )
            .foregroundStyle(document.parseStatus == .succeeded ? Tokens.Palette.affirmative : Tokens.Palette.attention)

            if document.parseStatus == .succeeded && document.rawExtractedKeywords.isEmpty {
                Text("We could not read any skills from that CV. Add them yourself below.")
                    .font(Tokens.Typography.caption)
                    .foregroundStyle(Tokens.Palette.secondaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            chooseFileButton(title: "Replace CV")
        }
        .accessibilityIdentifier("profile.cvLoaded")
    }

    private func chooseFileButton(title: LocalizedStringKey) -> some View {
        Button(title) { isPickingFile = true }
            .buttonStyle(.bordered)
            .minimumTapTarget()
            .accessibilityIdentifier("profile.chooseFile")
    }

    // MARK: - Review and edit (T037)

    private var keywordsSection: some View {
        Section {
            if model.keywords.isEmpty {
                Text("We could not read any skills from that CV. Add them yourself below.")
                    .font(Tokens.Typography.caption)
                    .foregroundStyle(Tokens.Palette.secondaryText)
            }
            ForEach(model.keywords, id: \.self) { keyword in
                HStack {
                    Text(keyword)
                    Spacer()
                    Button {
                        model.removeKeyword(keyword)
                    } label: {
                        Image(systemName: "minus.circle.fill")
                            .foregroundStyle(Tokens.Palette.dismissive)
                    }
                    .buttonStyle(.plain)
                    .minimumTapTarget()
                    .accessibilityLabel(Text("Remove \(keyword)"))
                }
            }
            HStack {
                TextField("Add a skill", text: $model.newKeyword)
                    .onSubmit { model.addKeyword() }
                    .accessibilityIdentifier("profile.newKeyword")
                Button {
                    model.addKeyword()
                } label: {
                    Image(systemName: "plus.circle.fill")
                }
                .buttonStyle(.plain)
                .minimumTapTarget()
                .accessibilityLabel(Text("Add a skill"))
                .accessibilityIdentifier("profile.addKeyword")
            }
        } header: {
            Text("Skills we found")
        } footer: {
            Text("Nothing here is used until you confirm it.")
        }
    }

    private var experienceSection: some View {
        Section(header: Text("Years of experience")) {
            TextField("Years of experience", text: $model.yoeText)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("profile.yoe")
        }
    }

    private var saveSection: some View {
        Section {
            Button {
                Task { await model.save() }
            } label: {
                Text("Save changes").frame(maxWidth: .infinity).minimumTapTarget()
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.isSaving)
            .accessibilityIdentifier("profile.save")

            if let saveError = model.saveError {
                Text(saveError)
                    .font(Tokens.Typography.caption)
                    .foregroundStyle(Tokens.Palette.dismissive)
            }
        }
    }
}
