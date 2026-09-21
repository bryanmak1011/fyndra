import Foundation
import Observation
import FyndraCore

/// The one piece of app-wide state: who is signed in, and the API client
/// carrying their token. Every feature view model takes the client from
/// here rather than constructing its own, so signing out invalidates them
/// all at once.
@MainActor
@Observable
final class AppSession {
    enum State: Equatable {
        case checking
        case signedOut
        case signedIn(UserProfile)
    }

    private(set) var state: State = .checking
    /// The protocol, not `APIClient` itself, so tests and UI-test runs can
    /// substitute a stub — see FyndraCore's FyndraAPI.
    let api: any FyndraAPI

    var profile: UserProfile? {
        if case let .signedIn(profile) = state { return profile }
        return nil
    }

    /// Set when the session is running against a stub: the UI-test build
    /// skips the real sign-in round trip because there is no server to
    /// issue a code.
    private let startsSignedIn: Bool

    init(api: any FyndraAPI = APIClient(), startsSignedIn: Bool = false) {
        self.api = api
        self.startsSignedIn = startsSignedIn
    }

    /// Restores a stored token on launch. A stored token can still be
    /// expired or revoked, so this proves it by actually reading the
    /// profile rather than trusting its presence.
    func restore() async {
        if startsSignedIn {
            state = (try? await api.getProfile()).map(State.signedIn) ?? .signedOut
            return
        }
        guard let token = TokenStore.load() else {
            state = .signedOut
            return
        }
        await api.setBearerToken(token)
        do {
            state = .signedIn(try await api.getProfile())
        } catch {
            // Expired, revoked, or the server is a different one now.
            // Either way the token is no longer usable — start clean
            // rather than leaving the app in a half-authenticated state.
            TokenStore.clear()
            await api.setBearerToken(nil)
            state = .signedOut
        }
    }

    func signIn(with response: AuthResponse) async {
        TokenStore.save(response.token)
        await api.setBearerToken(response.token)
        state = .signedIn(response.profile)
    }

    func signOut() async {
        TokenStore.clear()
        await api.setBearerToken(nil)
        state = .signedOut
    }

    /// Feature screens that change the profile (CV review, settings) push
    /// the updated copy back here so every other screen sees it.
    func updateProfile(_ profile: UserProfile) {
        state = .signedIn(profile)
    }

    /// Refreshes the cached profile — cheap, and the cap counters on it go
    /// stale as soon as the user swipes.
    func refreshProfile() async {
        guard case .signedIn = state, let refreshed = try? await api.getProfile() else { return }
        state = .signedIn(refreshed)
    }
}
