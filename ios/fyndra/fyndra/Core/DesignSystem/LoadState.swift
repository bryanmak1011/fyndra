import SwiftUI
import FyndraCore

/// The constitution requires every data-backed screen to handle loading,
/// empty, error and success explicitly (T036 spells it out for the CV
/// screen; it applies everywhere). Modelling it as one enum means a screen
/// cannot accidentally render "no results" while a request is still in
/// flight, which is the usual way that requirement gets missed.
enum LoadState<Value> {
    case loading
    case empty
    case failed(String)
    case loaded(Value)

    var value: Value? {
        if case let .loaded(value) = self { return value }
        return nil
    }

    var isLoading: Bool {
        if case .loading = self { return true }
        return false
    }
}

/// Turns a thrown error into something worth showing a person. Anything
/// unrecognised keeps the server's own message rather than being flattened
/// into "Something went wrong" — the API writes specific messages and
/// throwing them away makes support impossible.
enum ErrorMessage {
    static func text(for error: Error) -> String {
        if let clientError = error as? APIClientError {
            return switch clientError {
            case .unauthorized:
                String(localized: "Sign in to Fyndra")
            case let .server(_, body):
                body.message
            case .invalidResponse, .decodingFailed:
                String(localized: "Something went wrong")
            }
        }
        if let urlError = error as? URLError {
            // A cancelled request is the user leaving the screen, not a
            // failure — an empty string means "say nothing".
            return urlError.code == .cancelled ? "" : urlError.localizedDescription
        }
        return String(localized: "Something went wrong")
    }

    /// The 422 codes from `POST /profile/cv`, each with its own remedy —
    /// "upload failed" tells the user nothing they can act on.
    static func cvUploadText(for error: Error) -> String {
        guard case let APIClientError.server(status, body) = error, status == 422 else {
            return text(for: error)
        }
        return switch CvUploadRejection(errorCode: body.code) {
        case .noTextLayer:
            String(localized: "That PDF has no text layer — it looks scanned or photographed. Export a text PDF and try again.")
        case .unsupportedFormat:
            String(localized: "That file format is not supported. Upload a PDF or a .docx file.")
        case .passwordProtected:
            String(localized: "That file is password-protected. Remove the password and try again.")
        case nil:
            body.message
        }
    }
}

/// The empty/error state used by every list and feed screen, so they all
/// explain themselves the same way.
struct StatusPlaceholder: View {
    let systemImage: String
    let title: LocalizedStringKey
    let message: LocalizedStringKey
    var actionTitle: LocalizedStringKey?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Tokens.Spacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: 44))
                .foregroundStyle(Tokens.Palette.secondaryText)
                .accessibilityHidden(true)
            Text(title)
                .font(Tokens.Typography.cardTitle)
                .multilineTextAlignment(.center)
            Text(message)
                .font(Tokens.Typography.body)
                .foregroundStyle(Tokens.Palette.secondaryText)
                .multilineTextAlignment(.center)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(.borderedProminent)
                    .minimumTapTarget()
            }
        }
        .padding(Tokens.Spacing.xl)
        .frame(maxWidth: .infinity)
    }
}
