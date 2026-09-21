import Foundation
import Observation
import FyndraCore

/// T080. The list of everything the user has swiped right on (FR-011).
@MainActor
@Observable
final class TrackingViewModel {
    private(set) var state: LoadState<[Application]> = .loading

    private let session: AppSession

    init(session: AppSession) {
        self.session = session
    }

    /// The badge on the tab: how many applications are stuck waiting on the
    /// user. This is the working substitute for push until T079's Apple
    /// Developer push key exists.
    var actionableCount: Int {
        (state.value ?? []).count { $0.status.needsUserAction }
    }

    func load() async {
        if state.value == nil { state = .loading }
        do {
            let applications = try await session.api.getApplications()
            state = applications.isEmpty ? .empty : .loaded(applications)
        } catch {
            state = .failed(ErrorMessage.text(for: error))
        }
    }

    /// Replaces one row in place after a detail-screen action, so the list
    /// does not flash through a full reload for a single status change.
    func replace(_ application: Application) {
        guard var applications = state.value else { return }
        guard let index = applications.firstIndex(where: { $0.id == application.id }) else { return }
        applications[index] = application
        state = .loaded(applications)
    }
}

/// T081. One application's detail: the answer sheet, the questions only the
/// user can answer, and the status timeline.
@MainActor
@Observable
final class ApplicationDetailViewModel {
    private(set) var state: LoadState<ApplicationDetail> = .loading
    private(set) var isSubmitting = false
    var errorMessage: String?

    let applicationId: String
    private let session: AppSession

    init(applicationId: String, session: AppSession) {
        self.applicationId = applicationId
        self.session = session
    }

    func load() async {
        do {
            state = .loaded(try await session.api.getApplication(id: applicationId))
        } catch {
            state = .failed(ErrorMessage.text(for: error))
        }
    }

    /// Only the statuses that are legal from here. The server re-validates
    /// every transition and 409s an illegal one — this just keeps the UI
    /// from offering a control that can only fail.
    var offerableStatuses: [ApplicationStatus] {
        guard let current = state.value?.application.status,
              !current.isTerminal,
              !current.isPreSubmission
        else { return [] }
        return ApplicationStatus.userReportable.filter { $0 != current }
    }

    func confirm(editedAnswers: [EditedAnswer]) async {
        await perform { try await $0.confirmApplication(id: self.applicationId, editedAnswers: editedAnswers) }
    }

    func markHandoffComplete() async {
        await perform { try await $0.markHandoffComplete(applicationId: self.applicationId) }
    }

    func report(_ status: ApplicationStatus, note: String?) async {
        await perform { try await $0.reportStatus(applicationId: self.applicationId, status: status, note: note) }
    }

    func answer(question: ApplicationQuestion, text: String, allowReuse: Bool) async {
        await perform {
            try await $0.answerQuestion(
                applicationId: self.applicationId,
                questionId: question.id,
                // FR-022: a sensitive answer is never reused, whatever the
                // client asks for. The server enforces this too; sending
                // `false` means the UI never even appears to offer it.
                answer: text,
                allowReuse: question.isSensitive ? false : allowReuse
            )
        }
    }

    /// Every mutating action follows the same shape: submit, then re-read
    /// the detail rather than trusting a partial response — these endpoints
    /// return an `Application`, not an `ApplicationDetail`, so the timeline
    /// would otherwise go stale.
    private func perform(_ action: @escaping (any FyndraAPI) async throws -> Application) async {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            _ = try await action(session.api)
            await load()
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }
}
