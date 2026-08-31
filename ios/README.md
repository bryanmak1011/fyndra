# Swipe2Work iOS

Swift 6, SwiftUI, iOS 17+. See [../specs/001-job-swipe-apply/](../specs/001-job-swipe-apply/) for
the full design.

## What exists today

- **`Swipe2WorkCore/`** — a standalone Swift Package with no SwiftUI/UIKit
  dependency: the `APIClient` (URLSession, 30s/60s timeouts, exponential
  backoff on 5xx, bearer-token injection) and the contract models. Builds
  and tests with plain SwiftPM:

  ```bash
  cd Swipe2WorkCore
  swift build   # verified — compiles clean on Swift 6.3
  swift test    # NOT runnable in a Command-Line-Tools-only environment —
                 # see below. Runs fine in Xcode.
  ```

- **`Swipe2Work/`** — the app target's directory structure only
  (`App/`, `Features/{Profile,JobFeed,ApplicationTracking,Settings}/`,
  `Core/DesignSystem/`, `Resources/{en,zh-Hant}.lproj/`). No `.xcodeproj` and
  no source files yet — see below.

## Known gap: no Xcode project, and why

This scaffold was built in an environment with **Xcode Command Line Tools
only** (`xcodebuild` present but `xcode-select` reports no full Xcode.app,
and `xcrun --sdk iphonesimulator` fails — there is no iOS SDK). Two concrete
consequences:

1. **No `.xcodeproj` was generated.** Hand-authoring a `.pbxproj` reliably
   without Xcode is impractical and error-prone; a generator like XcodeGen
   isn't installed either. **Action needed**: open Xcode, "File → New →
   Project → App" (iOS, SwiftUI, Swift 6, name `Swipe2Work`, min deployment
   iOS 17.0), save it into this `ios/Swipe2Work/` directory structure
   (Xcode will offer to use the existing folder), then add
   `Swipe2WorkCore` as a local Swift Package dependency (File → Add Package
   Dependencies → Add Local... → select `../Swipe2WorkCore`).
2. **`swift test` doesn't run here** — this toolchain has neither `XCTest`
   nor the `Testing` (swift-testing) module available standalone; both
   normally ship with Xcode.app. `swift build` still fully compiles and
   type-checks the library target, which is a real signal, just not a
   substitute for running the test target in `APIClientTests.swift` — do
   that once the package is open in Xcode.

Everything under `Features/`, `Core/DesignSystem/`, and `Resources/` is an
empty directory, not stubbed source — see `tasks.md` T023 and the User
Story phases (T036 onward) for what populates them, and why they weren't
pre-filled with unused scaffolding now.
