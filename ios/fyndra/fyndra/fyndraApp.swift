import SwiftUI

@main
struct FyndraApp: App {
    /// Only for the APNs device-token callback, which has no SwiftUI
    /// equivalent — see PushPermission.swift.
    @UIApplicationDelegateAdaptor(PushRegistrationDelegate.self) private var pushDelegate

    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}
