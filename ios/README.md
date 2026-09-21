# Fyndra iOS

Swift 6, SwiftUI, iOS 17+. See [../specs/001-job-swipe-apply/](../specs/001-job-swipe-apply/) for
the full design.

## Layout

| Path | What it is |
|---|---|
| `FyndraCore/` | Standalone Swift Package, no SwiftUI/UIKit: `APIClient`, the `FyndraAPI` protocol, and every contract model. Builds and tests with plain `swift test`. |
| `fyndra/fyndra.xcodeproj` | The app project. Uses Xcode's file-system-synchronized groups, so **a new file under `fyndra/fyndra/` is in the build automatically** — no project edit needed. |
| `fyndra/fyndra/App/` | Session, Keychain token storage, root tab shell, push registration, and the UI-test stub backend. |
| `fyndra/fyndra/Core/` | Design tokens, load/error-state plumbing, and the `en` + `zh-Hant` String Catalog. |
| `fyndra/fyndra/Features/` | `Auth`, `Profile`, `JobFeed`, `ApplicationTracking`, `Settings`. |
| `fyndra/fyndraTests/` | View-model unit tests plus `Snapshot/` layout-regression tests. |
| `fyndra/fyndraUITests/` | `SwipeFeedUITests` (stubbed, always runs) and `DemoWalkthroughUITests` (live, opt-in). |

## Running the tests

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer

cd FyndraCore && swift test                      # 17 tests, no simulator needed

cd ../fyndra && xcodebuild test \
  -project fyndra.xcodeproj -scheme fyndra \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  CODE_SIGNING_ALLOWED=NO                        # 37 tests
```

`CODE_SIGNING_ALLOWED=NO` is only needed when building outside Xcode without
a provisioning profile; from Xcode itself, just press ⌘U.

### The two kinds of UI test

`SwipeFeedUITests` runs the app against `StubAPI`, an in-memory `FyndraAPI`
selected by the `-FyndraUITestStub` launch argument and compiled out of
RELEASE. It needs nothing running, so it belongs in CI.

`DemoWalkthroughUITests` is the real end-to-end pass — real server, real
Postgres, real worker — and **skips itself** unless told otherwise:

```bash
# api/.env needs the test-account bypass enabled:
#   AUTH_BYPASS_EMAILS=abc123@abcai.com

# terminal 1 and 2
cd ../api && npm run dev
cd ../api && npm run worker

# terminal 3 — give the test account a feed to swipe
cd ../api && npm run seed:demo -- abc123@abcai.com

# terminal 4
cd fyndra && TEST_RUNNER_FYNDRA_LIVE_WALKTHROUGH=1 xcodebuild test \
  -project fyndra.xcodeproj -scheme fyndra \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -only-testing:fyndraUITests/DemoWalkthroughUITests \
  CODE_SIGNING_ALLOWED=NO
```

It attaches a screenshot of every screen it visits; pull them out of the
result bundle with
`xcrun xcresulttool export attachments --path <...>.xcresult --output-path ./shots`.

It signs in with the bypass account rather than a real one-time code so that
it is **repeatable**. A code is single-use by design, so an earlier version of
this test passed once and then failed on every rerun until someone re-seeded.
The real request-code → verify round trip is covered against live Postgres by
`api/tests/contract/auth.test.ts`, and the code-entry UI by
`SignInViewModelTests`.

To sign in by hand as an ordinary account instead, either read the code from
the server's `auth_code_issued` log line (quickstart.md), or seed a known one:
`npm run seed:demo -- someone@example.com --login-code 424242`.

## Talking to the API

`BaseURLProvider` picks the base URL by build configuration: DEBUG uses
`http://localhost:3000/v1`, or `NGROK_BASE_URL` when that scheme environment
variable is set (physical device). RELEASE deliberately has no endpoint —
there is no cloud deployment in Phase 1 (SDD.md §11.3).

## Known gaps

- **Push notifications don't arrive.** `POST /devices` registration is real
  and wired to the first right-swipe prompt (T082), but the server's send
  path (T079) needs an Apple Developer push key the project does not have.
  The badge on the Applications tab is the working fallback in the meantime.
- **Snapshot tests are layout-regression tests, not pixel references.** They
  render the real views and assert they grow with Dynamic Type rather than
  clipping — see the file comment in `Snapshot/LayoutSnapshotTests.swift` for
  why, and what adopting swift-snapshot-testing would add.
- **SwiftLint has never been run** against `.swiftlint.yml`; it is not
  installed locally. The `ios` CI job is its first real exercise.
- **The project still lists macOS/visionOS in `SUPPORTED_PLATFORMS`**, left
  over from Xcode's multiplatform template. It builds and runs correctly as
  an iOS 17+ app; narrowing it is cosmetic cleanup.
