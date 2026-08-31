<!--
SYNC IMPACT REPORT
==================
Version change: [unversioned template] → 1.0.0
Added sections:
  - Core Principles (I–V: Code Quality, Test-First, UX Consistency, Performance, iOS Platform Standards)
  - Quality Gates
  - Governance
Modified principles: N/A (initial ratification)
Removed sections: N/A
Deferred TODOs:
  - TODO(PROJECT_NAME): Product name not yet defined — update when product direction is provided.
  - TODO(UIUX_STANDARDS): Design system tokens, component library, and HIG specifics deferred — update via /speckit-constitution when UX skills are added.
  - TODO(TOOLCHAIN): Specific Xcode version, dependency manager, and CI tooling deferred — update when development environment is defined.
  - TODO(MIN_IOS_VERSION): Minimum supported iOS version to be confirmed with product direction.
-->

# iOS App Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

Every line of code merged into the main branch MUST meet these standards without exception:

- **Single Responsibility**: Each function, class, and module MUST have one clearly defined purpose.
  Split anything that does two things.
- **Readability over cleverness**: Code MUST be written for the next engineer, not the compiler.
  Self-documenting names are required; inline comments are reserved for non-obvious *why*, never *what*.
- **No dead code**: Commented-out code blocks, unreachable branches, and unused symbols MUST be
  removed before merge — not deferred.
- **Minimal dependencies**: Every third-party library MUST be explicitly justified. Prefer platform
  APIs (Foundation, SwiftUI, UIKit) over external packages unless the benefit is clear and
  the library is actively maintained.
- **Cyclomatic complexity**: Functions MUST NOT exceed a complexity score of 10. Refactor before
  submitting for review.
- **Immutability by default**: Prefer `let` over `var`, value types over reference types. Mutability
  MUST be justified.

**Rationale**: Unmaintainable code is a compounding liability on a mobile product where iteration
speed and reliability are both critical. These rules protect the team's ability to move fast safely.

### II. Test-First Development (NON-NEGOTIABLE)

Testing is not an afterthought — it is part of the definition of done.

- **TDD cycle enforced**: For all business logic, the sequence MUST be: write failing test →
  get approval → implement → pass → refactor. No exceptions for "simple" changes.
- **Unit test coverage**: Business logic, view models, and service layers MUST maintain ≥ 80%
  line coverage. Coverage MUST NOT drop below this threshold on any PR.
- **UI/integration tests**: All critical user flows (onboarding, core feature interactions, error
  recovery paths) MUST have automated UI tests.
- **Snapshot tests**: Reusable UI components MUST have snapshot tests to catch unintended visual
  regressions. Snapshots are committed to source control and reviewed in PRs.
- **No mocking the platform**: Tests MUST use real framework types wherever feasible. Mock only
  at external boundaries (network, device sensors, system auth).
- **Tests run in CI**: The full test suite MUST pass in CI before any PR can be merged. A failing
  test is a blocker — not a warning.

**Rationale**: App Store releases are not easily rolled back. High test confidence is the primary
defense against shipping defects to users.

### III. User Experience Consistency (NON-NEGOTIABLE)

Every screen and interaction MUST feel like it belongs to the same product.

- **Design token adherence**: Colors, typography scales, spacing units, corner radii, and shadow
  values MUST be sourced from the centralized design token system.
  TODO(UIUX_STANDARDS): Token definitions and component library to be specified when UX skills
  are configured.
- **All states designed and implemented**: Every screen MUST implement loading, empty, error, and
  success states. Shipping a screen without all states is not considered complete.
- **Accessibility (a11y) built-in**: Accessibility is a first-class requirement, not a post-launch
  task. All interactive elements MUST have VoiceOver labels. Dynamic Type MUST be supported.
  Minimum tap target size: 44×44 pt per Apple HIG.
- **Animation consistency**: Transitions and micro-interactions MUST use consistent durations
  (standard: 300 ms ease-in-out) and MUST respect the user's Reduce Motion setting.
- **Platform conventions**: The app MUST follow Apple Human Interface Guidelines. Custom patterns
  that deviate from platform conventions MUST be explicitly justified and validated with user
  testing.

**Rationale**: Inconsistency erodes user trust and increases support burden. A unified feel is
non-negotiable regardless of which engineer touched which screen.

### IV. Performance Requirements

Performance is a feature. Degradation is a regression.

- **Cold launch time**: App MUST reach interactive state in ≤ 2 seconds on the oldest supported
  device tier. Measured via Instruments Time Profiler in CI.
- **Screen transition latency**: All navigation transitions MUST complete within 300 ms. Transitions
  that exceed this MUST be investigated and fixed before merge.
- **Main thread protection**: All network I/O, disk I/O, and heavy computation MUST execute off
  the main thread. UI updates MUST be dispatched back to the main actor. Main thread hangs > 16 ms
  MUST be treated as bugs.
- **Memory ceiling**: The app MUST NOT exceed 150 MB of resident memory under typical usage.
  Memory warnings MUST trigger resource release. Retain cycles are zero-tolerance bugs.
- **Image and asset handling**: Images MUST be appropriately sized for their display context,
  cached after first load, and decoded off the main thread. No raw full-resolution images in
  table/collection view cells.
- **Battery discipline**: Background work MUST be limited to system-provided background modes.
  Polling-based patterns are prohibited; use push, `URLSession` background tasks, or
  `BackgroundTasks` framework instead.
- **Network efficiency**: All API calls MUST define explicit timeouts (default: 30 s connect,
  60 s read). Retry policies MUST use exponential backoff. Requests MUST be cancelled when their
  initiating view leaves the screen.

**Rationale**: Users uninstall slow or battery-draining apps. Performance regressions caught late
are expensive; catching them in CI is cheap.

### V. iOS Platform Standards

The app MUST be a good citizen on Apple's platform.

- **Supported OS versions**: The app MUST support the current and previous major iOS versions
  (e.g., iOS 17 and iOS 18 at launch). TODO(MIN_IOS_VERSION): Confirm with product direction.
- **No private APIs**: Use of any private Apple APIs is prohibited. Violations will cause App
  Store rejection and are non-negotiable blockers.
- **Privacy by design**: Data collection MUST be minimized to what is functionally required.
  All permission requests (camera, location, notifications, etc.) MUST be triggered contextually
  with a clear use-case explanation shown before the system prompt. Privacy manifest (`PrivacyInfo.xcprivacy`)
  MUST be maintained and accurate.
- **App Store compliance**: All features MUST comply with the App Store Review Guidelines at the
  time of submission. New features with monetization, user-generated content, or data collection
  MUST be reviewed against guidelines before development begins.
- **Device compatibility**: TODO(UIUX_STANDARDS): iPhone/iPad support scope to be confirmed with
  product direction. Until specified, implement for iPhone portrait and landscape.

**Rationale**: Non-compliance with Apple's platform rules blocks distribution. Privacy violations
damage user trust and carry regulatory risk.

## Quality Gates

A feature or change is only considered **done** when all of the following are true:

- [ ] All new code has unit tests; coverage threshold (≥ 80%) is maintained or improved.
- [ ] UI tests cover any new critical user flow introduced by the change.
- [ ] Snapshot tests updated/added for any new or modified components.
- [ ] All states (loading, empty, error, success) are implemented for any new screen.
- [ ] Accessibility labels verified via VoiceOver on a physical device or simulator.
- [ ] Instruments profiling shows no main-thread hangs or memory leaks introduced.
- [ ] Cold launch time benchmark has not regressed.
- [ ] PR has been reviewed and approved by at least one other engineer.
- [ ] CI pipeline is fully green (build, lint, test, snapshot diff).
- [ ] No commented-out code or dead code added.

## Governance

This constitution is the authoritative governance document for all engineering decisions on this
project. It supersedes team conventions, personal preferences, and informal agreements.

**Compliance**: Every PR review MUST verify compliance with this constitution. Non-compliance is
a valid and expected reason to request changes.

**Amendment process**:
1. Propose the change in writing, citing the motivation and impact.
2. At least two engineers (or the product/tech lead where team size requires) MUST review and
   approve the amendment.
3. A migration plan MUST accompany any amendment that invalidates existing code.
4. Update this document and increment the version per the versioning policy below.

**Versioning policy**:
- `MAJOR`: Removal of a principle, redefinition that invalidates prior work, or incompatible
  governance change.
- `MINOR`: New principle added, new section added, or material expansion of existing guidance.
- `PATCH`: Clarification, wording improvement, typo fix, or non-semantic refinement.

**Review cadence**: This constitution MUST be reviewed at the start of each major product phase
or at minimum every 3 months, whichever comes first. The review MUST assess whether deferred
TODOs (UX standards, toolchain, product scope) can be resolved.

**Version**: 1.0.0 | **Ratified**: 2026-08-28 | **Last Amended**: 2026-08-28
