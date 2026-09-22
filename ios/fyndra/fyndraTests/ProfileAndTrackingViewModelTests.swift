import Testing
import Foundation
@testable import fyndra
@testable import FyndraCore

@MainActor
struct ProfileViewModelTests {
    @Test func aParsedExtractionIsNeverAppliedWithoutAnExplicitSave() async {
        // FR-003: what the parser found is a proposal. The profile keeps
        // its own values until the user presses save.
        let api = ScriptedAPI()
        // `startsSignedIn` is the same path the UI-test stub build uses:
        // there is no token to restore, so read the profile directly.
        let session = AppSession(api: api, startsSignedIn: true)
        await session.restore()
        let model = ProfileViewModel(session: session)
        await model.load()

        model.keywords = ["Swift", "SwiftUI"]
        #expect(await api.profileUpdates.isEmpty)

        await model.save()

        #expect(await api.profileUpdates.count == 1)
        #expect(await api.profileUpdates.first?.keywords == ["Swift", "SwiftUI"])
        #expect(session.profile?.keywords == ["Swift", "SwiftUI"])
    }

    @Test func savesTheEditedYearsOfExperienceAsANumber() async {
        let api = ScriptedAPI()
        // `startsSignedIn` is the same path the UI-test stub build uses:
        // there is no token to restore, so read the profile directly.
        let session = AppSession(api: api, startsSignedIn: true)
        await session.restore()
        let model = ProfileViewModel(session: session)
        await model.load()

        model.yoeText = "8"
        await model.save()

        #expect(await api.profileUpdates.first?.yoe == 8)
    }

    @Test func addingASkillIgnoresBlanksAndDuplicates() async {
        let model = ProfileViewModel(session: AppSession(api: ScriptedAPI()))

        model.newKeyword = "Go"
        model.addKeyword()
        model.newKeyword = "  "
        model.addKeyword()
        model.newKeyword = "Go"
        model.addKeyword()

        #expect(model.keywords == ["Go"])
        #expect(model.newKeyword == "Go", "a rejected duplicate leaves the field alone rather than clearing it")
    }

    @Test func reportsAMissingCvAsEmptyRatherThanAsAnError() async {
        let api = ScriptedAPI()
        await api.setCv(nil)
        let model = ProfileViewModel(session: AppSession(api: api))

        await model.load()

        if case .empty = model.cvState {} else {
            Issue.record("a profile with no CV yet is an empty state, not a failure: \(model.cvState)")
        }
    }
}

@MainActor
struct TrackingViewModelTests {
    private func application(id: String, status: ApplicationStatus) -> Application {
        Application(
            id: id,
            jobPostingId: "job-\(id)",
            jobTitle: "Role \(id)",
            employer: "Employer \(id)",
            submissionMode: .reviewBeforeSending,
            applyRoute: .handoff,
            status: status
        )
    }

    @Test func countsOnlyTheApplicationsWaitingOnTheUser() async {
        // This drives the tab badge, which is the working stand-in for push
        // until the APNs key exists (T079).
        let api = ScriptedAPI()
        await api.setApplications([
            application(id: "1", status: .awaitingReview),
            application(id: "2", status: .pendingNeedsAnswer),
            application(id: "3", status: .applied),
            application(id: "4", status: .hired)
        ])
        let model = TrackingViewModel(session: AppSession(api: api))

        await model.load()

        #expect(model.actionableCount == 2)
    }

    @Test func anEmptyListIsAnEmptyStateNotAnError() async {
        let model = TrackingViewModel(session: AppSession(api: ScriptedAPI()))

        await model.load()

        if case .empty = model.state {} else {
            Issue.record("expected the empty state, got \(model.state)")
        }
    }

    @Test func replacingOneRowLeavesTheRestAlone() async {
        let api = ScriptedAPI()
        await api.setApplications([
            application(id: "1", status: .awaitingReview),
            application(id: "2", status: .applied)
        ])
        let model = TrackingViewModel(session: AppSession(api: api))
        await model.load()

        model.replace(application(id: "1", status: .handedOff))

        #expect(model.state.value?.map(\.status) == [.handedOff, .applied])
    }
}

@MainActor
struct ApplicationDetailViewModelTests {
    private func detail(status: ApplicationStatus, questions: [ApplicationQuestion] = []) -> ApplicationDetail {
        ApplicationDetail(
            application: Application(
                id: "a1",
                jobPostingId: "job-1",
                jobTitle: "iOS Engineer",
                employer: "Klook",
                submissionMode: .reviewBeforeSending,
                applyRoute: .handoff,
                status: status,
                pendingQuestions: questions
            ),
            statusHistory: [ApplicationStatusEvent(status: status, occurredAt: .now)]
        )
    }

    @Test func offersNoStatusChangeWhileTheApplicationIsStillTheSystemsToMove() async {
        let api = ScriptedAPI()
        await api.setApplicationDetail(detail(status: .awaitingReview))
        let model = ApplicationDetailViewModel(applicationId: "a1", session: AppSession(api: api))

        await model.load()

        #expect(model.offerableStatuses.isEmpty)
    }

    @Test func offersNoStatusChangeFromATerminalState() async {
        let api = ScriptedAPI()
        await api.setApplicationDetail(detail(status: .hired))
        let model = ApplicationDetailViewModel(applicationId: "a1", session: AppSession(api: api))

        await model.load()

        #expect(model.offerableStatuses.isEmpty)
    }

    @Test func offersTheUserReportableStatusesAfterSubmission() async {
        let api = ScriptedAPI()
        await api.setApplicationDetail(detail(status: .applied))
        let model = ApplicationDetailViewModel(applicationId: "a1", session: AppSession(api: api))

        await model.load()

        #expect(model.offerableStatuses.contains(.interview))
        #expect(!model.offerableStatuses.contains(.applied), "the current status is not a transition")
        #expect(!model.offerableStatuses.contains(.queued), "pre-submission states are system-owned")
    }

    @Test func aSensitiveAnswerIsNeverSentWithReuseEnabled() async {
        // FR-022. The server enforces this too; the client must not even
        // appear to offer it.
        let sensitive = ApplicationQuestion(id: "q1", questionText: "期望薪資", isSensitive: true)
        let api = ScriptedAPI()
        await api.setApplicationDetail(detail(status: .pendingNeedsAnswer, questions: [sensitive]))
        let model = ApplicationDetailViewModel(applicationId: "a1", session: AppSession(api: api))
        await model.load()

        await model.answer(question: sensitive, text: "HK$70,000", allowReuse: true)

        #expect(await api.answeredQuestions.first?.allowReuse == false)
    }

    @Test func anOrdinaryAnswerHonoursTheReuseChoice() async {
        let ordinary = ApplicationQuestion(id: "q2", questionText: "Why this role?", isSensitive: false)
        let api = ScriptedAPI()
        await api.setApplicationDetail(detail(status: .pendingNeedsAnswer, questions: [ordinary]))
        let model = ApplicationDetailViewModel(applicationId: "a1", session: AppSession(api: api))
        await model.load()

        await model.answer(question: ordinary, text: "Because…", allowReuse: true)

        #expect(await api.answeredQuestions.first?.allowReuse == true)
    }
}

@MainActor
struct SignInViewModelTests {
    @Test func willNotSendACodeToSomethingThatIsNotAnEmail() {
        let model = SignInViewModel(session: AppSession(api: ScriptedAPI()))

        model.email = "nope"
        #expect(!model.canSendCode)

        model.email = "demo@fyndra.test"
        #expect(model.canSendCode)
    }

    @Test func requiresASixDigitCodeBeforeVerifying() async {
        let model = SignInViewModel(session: AppSession(api: ScriptedAPI()))
        model.email = "demo@fyndra.test"
        await model.sendCode()

        model.code = "1234"
        #expect(!model.canVerify)

        model.code = "424242"
        #expect(model.canVerify)
    }

    @Test func signsInImmediatelyWhenTheServerReturnsASessionForATestAccount() async {
        // A configured bypass account (the API's AUTH_BYPASS_EMAILS) gets a
        // session straight from request-code and must never see the code
        // step.
        let api = ScriptedAPI()
        let profile = await api.profile
        await api.setBypassSession(
            AuthResponse(token: "t", expiresAt: .now.addingTimeInterval(86_400), profile: profile)
        )
        let session = AppSession(api: api)
        let model = SignInViewModel(session: session)
        model.email = "abc123@abcai.com"

        await model.sendCode()

        #expect(model.step == .enteringEmail, "the code step must be skipped entirely")
        #expect(session.state == .signedIn(profile))
    }

    @Test func anOrdinaryAccountStillHasToEnterACode() async {
        let api = ScriptedAPI()
        await api.setBypassSession(nil)
        let session = AppSession(api: api)
        let model = SignInViewModel(session: session)
        model.email = "someone@example.com"

        await model.sendCode()

        #expect(model.step == .enteringCode(email: "someone@example.com"))
        #expect(session.state != .signedIn(await api.profile))
    }

    @Test func movesToTheCodeStepWithTheAddressNormalised() async {
        let model = SignInViewModel(session: AppSession(api: ScriptedAPI()))
        model.email = "  Demo@Fyndra.test "

        await model.sendCode()

        #expect(model.step == .enteringCode(email: "demo@fyndra.test"))
    }
}
