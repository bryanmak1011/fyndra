import Foundation
import Observation
import FyndraCore

/// Two-step email + one-time-code sign-in (FR-026). There is no password
/// and no refresh token, so this is the only way into the app.
@MainActor
@Observable
final class SignInViewModel {
    enum Step: Equatable {
        case enteringEmail
        case enteringCode(email: String)
    }

    var step: Step = .enteringEmail
    var email = ""
    var code = ""
    var errorMessage: String?
    private(set) var isSubmitting = false

    private let session: AppSession

    init(session: AppSession) {
        self.session = session
    }

    var canSendCode: Bool {
        !isSubmitting && email.contains("@") && email.count > 3
    }

    var canVerify: Bool {
        !isSubmitting && code.count == 6
    }

    func sendCode() async {
        guard canSendCode else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let address = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        do {
            // A configured test account comes back already signed in and
            // never sees the code step (see the API's AUTH_BYPASS_EMAILS).
            // Everyone else gets nil here.
            if let bypassSession = try await session.api.requestLoginCode(email: address) {
                await session.signIn(with: bypassSession)
                return
            }
            step = .enteringCode(email: address)
        } catch {
            errorMessage = ErrorMessage.text(for: error)
        }
    }

    func verify() async {
        guard case let .enteringCode(address) = step, canVerify else { return }
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        do {
            let response = try await session.api.verifyLoginCode(email: address, code: code)
            await session.signIn(with: response)
        } catch {
            errorMessage = ErrorMessage.text(for: error)
            code = ""
        }
    }

    func startOver() {
        step = .enteringEmail
        code = ""
        errorMessage = nil
    }
}
