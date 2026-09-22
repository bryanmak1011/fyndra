import SwiftUI

/// Decides between the sign-in screen and the app, and owns the tab bar.
/// Kept deliberately thin: everything it does is choose, so a change to any
/// one feature never touches this file.
struct RootView: View {
    @State private var session = RootView.makeSession()

    /// UI tests launch with `-FyndraUITestStub` and get an in-memory
    /// backend; every other build talks to the real API.
    private static func makeSession() -> AppSession {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-FyndraUITestStub") {
            return AppSession(api: StubAPI(), startsSignedIn: true)
        }
        // The live walkthrough has to start from the sign-in screen; a
        // token left in the Keychain by the previous run would skip it.
        if ProcessInfo.processInfo.arguments.contains("-FyndraForgetToken") {
            TokenStore.clear()
        }
        #endif
        return AppSession()
    }

    var body: some View {
        Group {
            switch session.state {
            case .checking:
                ProgressView { Text("Loading…") }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Tokens.Palette.canvas)
            case .signedOut:
                // A fresh SignInView per sign-out, so a previous attempt's
                // half-typed email and error never survive into the next.
                SignInView(session: session)
                    .id("signed-out")
            case .signedIn:
                signedInTabs
            }
        }
        .task {
            PushRegistrationDelegate.session = session
            await session.restore()
        }
    }

    private var signedInTabs: some View {
        TabView {
            JobFeedView(session: session)
                .tabItem { Label("Jobs", systemImage: "rectangle.stack") }
                .accessibilityIdentifier("tab.jobs")

            TrackingListView(session: session)
                .tabItem { Label("Applications", systemImage: "list.bullet.clipboard") }
                .accessibilityIdentifier("tab.applications")

            ProfileView(session: session)
                .tabItem { Label("Profile", systemImage: "person.crop.circle") }
                .accessibilityIdentifier("tab.profile")

            SettingsView(session: session)
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .accessibilityIdentifier("tab.settings")
        }
    }
}
