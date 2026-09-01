// swift-tools-version: 6.0
import PackageDescription

// Platform-agnostic core: the API client and contract models, with no
// SwiftUI/UIKit dependency. Kept separate from the app target so it builds
// and tests with plain `swift build`/`swift test` — no Xcode/iOS SDK
// required — and so it's a candidate for sharing with a future Android
// client's business-logic layer if that's ever worth doing.
let package = Package(
    name: "FyndraCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "FyndraCore", targets: ["FyndraCore"])
    ],
    targets: [
        .target(name: "FyndraCore"),
        .testTarget(name: "FyndraCoreTests", dependencies: ["FyndraCore"]),
    ]
)
