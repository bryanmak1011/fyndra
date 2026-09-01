import Foundation

/// Selects the API base URL by build configuration, per the plan's
/// Migration Controls: DEBUG points at the Simulator's localhost or, on a
/// physical device, an ngrok tunnel URL supplied via the `NGROK_BASE_URL`
/// scheme environment variable. RELEASE has no endpoint in Phase 1 — see
/// SDD.md §11.3 — so it intentionally has no working default yet.
public enum BaseURLProvider {
    public static var current: URL {
        #if DEBUG
        if let ngrokURLString = ProcessInfo.processInfo.environment["NGROK_BASE_URL"],
           let ngrokURL = URL(string: ngrokURLString) {
            return ngrokURL
        }
        return URL(string: "http://localhost:3000/v1")!
        #else
        fatalError(
            "No RELEASE API endpoint configured yet — Phase 1 has no cloud deployment (SDD.md §11.3)."
        )
        #endif
    }
}
