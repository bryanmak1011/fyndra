import Foundation
import UserNotifications
import UIKit
import Observation
import FyndraCore

/// T082 / constitution V: the notification prompt appears at the user's
/// first right swipe — the moment they have something worth being told
/// about — not at launch, where it is just a modal in front of an app
/// nobody has seen yet.
///
/// The registered APNs token is posted to `POST /devices`. The server's
/// send path (T079) needs an Apple Developer push key that this project
/// does not have yet, so a registered token currently goes nowhere; the
/// registration itself is real and correct, and the in-app badge on the
/// tracking tab is the working fallback in the meantime.
@MainActor
@Observable
final class PushPermission {
    private(set) var hasAsked = false

    func requestIfNeeded(session: AppSession) {
        guard !hasAsked else { return }
        hasAsked = true

        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            guard settings.authorizationStatus == .notDetermined else { return }

            let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
            guard granted else { return }
            UIApplication.shared.registerForRemoteNotifications()
        }
    }
}

/// Receives the APNs token from UIKit and forwards it. `UIApplication`'s
/// device-token callbacks have no SwiftUI equivalent, so this is the one
/// place the app still needs an app delegate.
final class PushRegistrationDelegate: NSObject, UIApplicationDelegate {
    /// Set by the app at launch; the token can arrive before the user has
    /// signed in, in which case there is nobody to register it for.
    nonisolated(unsafe) static weak var session: AppSession?

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { @MainActor in
            guard let session = Self.session, session.profile != nil else { return }
            try? await session.api.registerDevice(pushToken: token)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        // Nothing to do but carry on: the in-app badge still works, and
        // there is no user-actionable remedy for an APNs registration
        // failure.
    }
}
