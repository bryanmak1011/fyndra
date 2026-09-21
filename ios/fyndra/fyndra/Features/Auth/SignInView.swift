import SwiftUI

struct SignInView: View {
    @State private var model: SignInViewModel

    init(session: AppSession) {
        _model = State(initialValue: SignInViewModel(session: session))
    }

    var body: some View {
        VStack(spacing: Tokens.Spacing.lg) {
            Spacer()

            VStack(spacing: Tokens.Spacing.sm) {
                Image(systemName: "rectangle.stack.badge.person.crop")
                    .font(.system(size: 52))
                    .foregroundStyle(Tokens.Palette.accent)
                    .accessibilityHidden(true)
                Text("Sign in to Fyndra")
                    .font(.largeTitle.weight(.bold))
                Text("We'll email you a 6-digit code. There is no password to remember.")
                    .font(Tokens.Typography.body)
                    .foregroundStyle(Tokens.Palette.secondaryText)
                    .multilineTextAlignment(.center)
            }

            switch model.step {
            case .enteringEmail:
                emailStep
            case let .enteringCode(email):
                codeStep(email: email)
            }

            if let errorMessage = model.errorMessage, !errorMessage.isEmpty {
                Text(errorMessage)
                    .font(Tokens.Typography.caption)
                    .foregroundStyle(Tokens.Palette.dismissive)
                    .multilineTextAlignment(.center)
            }

            Spacer()
        }
        .padding(Tokens.Spacing.lg)
        .background(Tokens.Palette.canvas)
    }

    private var emailStep: some View {
        VStack(spacing: Tokens.Spacing.md) {
            TextField("Email address", text: $model.email)
                .textFieldStyle(.roundedBorder)
                .textContentType(.emailAddress)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityIdentifier("signIn.email")

            Button {
                Task { await model.sendCode() }
            } label: {
                Text("Send code")
                    .frame(maxWidth: .infinity)
                    .minimumTapTarget()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.canSendCode)
            .accessibilityIdentifier("signIn.sendCode")
        }
    }

    private func codeStep(email: String) -> some View {
        VStack(spacing: Tokens.Spacing.md) {
            Text("Enter the 6-digit code we sent to \(email).")
                .font(Tokens.Typography.body)
                .multilineTextAlignment(.center)

            TextField("Verification code", text: $model.code)
                .textFieldStyle(.roundedBorder)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .multilineTextAlignment(.center)
                .font(.title2.monospacedDigit())
                .accessibilityIdentifier("signIn.code")

            Button {
                Task { await model.verify() }
            } label: {
                Text("Verify")
                    .frame(maxWidth: .infinity)
                    .minimumTapTarget()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!model.canVerify)
            .accessibilityIdentifier("signIn.verify")

            Button("Use a different email") { model.startOver() }
                .font(Tokens.Typography.caption)
                .minimumTapTarget()
        }
    }
}
