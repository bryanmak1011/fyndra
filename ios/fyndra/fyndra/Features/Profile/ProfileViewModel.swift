import Foundation
import Observation
import FyndraCore

/// T036/T037. CV upload and the review-and-edit step that follows it.
///
/// FR-003 is the rule that shapes this: what the model extracted is a
/// *proposal*. Nothing the parser produced is applied to the profile until
/// the user presses save, so the editable fields here start from the CV's
/// raw extraction and the profile keeps its previous values until then.
@MainActor
@Observable
final class ProfileViewModel {
    enum UploadState: Equatable {
        case idle
        case uploading
        case parsing
        case failed(String)
    }

    private(set) var cvState: LoadState<CvDocument> = .loading
    private(set) var uploadState: UploadState = .idle

    /// The editable copy the review screen binds to (T037).
    var keywords: [String] = []
    var yoeText = ""
    var newKeyword = ""
    private(set) var isSaving = false
    var saveError: String?

    private let session: AppSession
    private var pollTask: Task<Void, Never>?

    init(session: AppSession) {
        self.session = session
    }

    /// Called from `.onDisappear`, not `deinit`: `deinit` is nonisolated, so
    /// it cannot touch `pollTask` at all under Swift 6.
    func cancelPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    var hasUnsavedChanges: Bool {
        guard let profile = session.profile else { return false }
        return keywords != profile.keywords || yoeText != (profile.yoe.map(String.init) ?? "")
    }

    func load() async {
        seedEditorsFromProfile()
        do {
            let document = try await session.api.getCv()
            cvState = .loaded(document)
            if document.parseStatus == .parsing { startPolling() }
        } catch let APIClientError.server(status, _) where status == 404 {
            cvState = .empty
        } catch {
            cvState = .failed(ErrorMessage.text(for: error))
        }
    }

    /// Reads the picked file and uploads it. A 422 is a rejection with a
    /// named reason, not a transport failure, so it gets its own message.
    func upload(fileURL: URL) async {
        uploadState = .uploading
        do {
            // A document-picker URL is security-scoped: without this the
            // read fails with a permission error that looks like a
            // corrupt file.
            let scoped = fileURL.startAccessingSecurityScopedResource()
            defer { if scoped { fileURL.stopAccessingSecurityScopedResource() } }

            let data = try Data(contentsOf: fileURL)
            let document = try await session.api.uploadCv(
                filename: fileURL.lastPathComponent,
                fileData: data
            )
            cvState = .loaded(document)
            uploadState = document.parseStatus == .parsing ? .parsing : .idle
            if document.parseStatus == .parsing { startPolling() }
        } catch {
            uploadState = .failed(ErrorMessage.cvUploadText(for: error))
        }
    }

    /// Parsing is asynchronous and there is no push key wired yet (T079),
    /// so the screen polls. Bounded, so a permanently stuck parse does not
    /// poll the server forever.
    private func startPolling() {
        pollTask?.cancel()
        pollTask = Task { [weak self] in
            for _ in 0..<40 {
                try? await Task.sleep(for: .seconds(3))
                if Task.isCancelled { return }
                guard let self else { return }
                guard let document = try? await self.session.api.getCv() else { continue }
                self.cvState = .loaded(document)
                if document.parseStatus != .parsing {
                    self.uploadState = .idle
                    self.adoptExtraction(from: document)
                    return
                }
            }
        }
    }

    /// Fills the review fields with what the parser found — but only where
    /// the user has not already typed something, so a late-arriving parse
    /// never overwrites an edit in progress.
    private func adoptExtraction(from document: CvDocument) {
        if keywords.isEmpty { keywords = document.rawExtractedKeywords }
        if yoeText.isEmpty, let yoe = document.rawExtractedYoe { yoeText = String(yoe) }
    }

    func addKeyword() {
        let trimmed = newKeyword.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !keywords.contains(trimmed) else { return }
        keywords.append(trimmed)
        newKeyword = ""
    }

    func removeKeyword(_ keyword: String) {
        keywords.removeAll { $0 == keyword }
    }

    /// FR-003: this is the only path by which an extraction becomes part of
    /// the profile.
    func save() async {
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            let updated = try await session.api.updateProfile(
                UserProfileUpdate(yoe: Int(yoeText), keywords: keywords)
            )
            session.updateProfile(updated)
        } catch {
            saveError = ErrorMessage.text(for: error)
        }
    }

    private func seedEditorsFromProfile() {
        guard let profile = session.profile else { return }
        if keywords.isEmpty { keywords = profile.keywords }
        if yoeText.isEmpty { yoeText = profile.yoe.map(String.init) ?? "" }
    }
}
