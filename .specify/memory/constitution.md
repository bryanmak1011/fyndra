<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Modified principles: N/A (no existing principle redefined or removed)
Added sections:
  - Core Principles VI. Backend Engineering Standards (NON-NEGOTIABLE)
  - Quality Gates: three backend-specific gate lines
Removed sections: N/A
Resolved TODOs:
  - TODO(PROJECT_NAME): resolved — product is Fyndra. Internal/repo use only; external use
    (App Store Connect, domain, marketing) is blocked on a real trademark clearance search
    (see specs/001-job-swipe-apply/SDD.md rev 3.2, Appendix B4).
  - TODO(MIN_IOS_VERSION): resolved — iOS 17+, per specs/001-job-swipe-apply/plan.md.
Deferred TODOs (unchanged, still genuinely undecided):
  - TODO(UIUX_STANDARDS): Design system tokens, component library, and HIG specifics deferred —
    update via /speckit-constitution when UX skills are added.
  - TODO(TOOLCHAIN): Specific Xcode version, dependency manager, and CI tooling deferred — update
    when development environment is defined.
Rationale for this amendment: this feature (specs/001-job-swipe-apply) ships a real backend
(api/ — Node/TypeScript/Express/Prisma/PostgreSQL), not just an iOS client. The constitution was
iOS-only and had no governance for server-side code, so backend PRs had no constitutional gate to
be checked against. Principle VI codifies conventions this codebase already follows in practice
(real-dependency TDD, enforced coverage thresholds, verify-before-build, untrusted-text discipline
for LLM-touching code) rather than introducing new, unproven rules. Tracked as tasks.md T092.
-->

# Fyndra Constitution

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
  APIs (Foundation, SwiftUI, UIKit; Node built-ins) over external packages unless the benefit is
  clear and the library is actively maintained.
- **Cyclomatic complexity**: Functions MUST NOT exceed a complexity score of 10. Refactor before
  submitting for review.
- **Immutability by default**: Prefer `let`/`const` over `var`, value types over reference types.
  Mutability MUST be justified.

**Rationale**: Unmaintainable code is a compounding liability on a product where iteration speed
and reliability are both critical. These rules protect the team's ability to move fast safely.

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

**Rationale**: App Store releases are not easily rolled back, and a live server has real users
mid-request. High test confidence is the primary defense against shipping defects.

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

- **Supported OS versions**: The app MUST support iOS 17 and later, per
  specs/001-job-swipe-apply/plan.md. Update this line if the minimum is later raised.
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

### VI. Backend Engineering Standards (NON-NEGOTIABLE)

The server (`api/` — Node/TypeScript/Express/Prisma/PostgreSQL) is held to the same non-negotiable
bar as the client, adapted to server-side reality.

- **Test-first, real dependencies**: The TDD cycle in Principle II applies here too, with one
  server-specific rule: tests MUST run against a real PostgreSQL database, not a mocked ORM layer.
  Mock only at true external boundaries — third-party HTTP APIs, the LLM provider, the filesystem
  — never the database. A passing test against a mock query result is not evidence the real query
  works.
- **Coverage threshold enforced in CI, not just claimed**: Business logic MUST maintain ≥ 80%
  line/statement/function coverage and ≥ 70% branch coverage, enforced via `coverageThreshold` in
  `api/jest.config.js` (excluding thin process-bootstrap files, e.g. `server.ts`/`worker.ts`, which
  are exercised through contract tests rather than unit coverage). A PR that drops below threshold
  MUST close the gap with tests of real logic, not by weakening the gate.
- **Verify external APIs before building against them**: Before writing any code that calls an
  external HTTP API — a job-board source, an ATS provider, an LLM gateway — its actual
  request/response shape MUST be confirmed live (via docs or a real call) before implementation
  code is written against an assumed shape. Guessing at an undocumented endpoint, especially for
  any action with a real-world side effect (submitting data on a user's behalf), is prohibited;
  when verification isn't possible, the work MUST stop and the blocker MUST be recorded (see
  `specs/001-job-swipe-apply/BLOCKERS.md`) rather than proceeding on an assumption.
- **Untrusted external text is data, never instructions**: Any text sourced from outside this
  codebase's control — a CV, a job description, an ATS question — that is passed to an LLM MUST be
  explicitly framed as untrusted data (e.g. clearly delimited, with an explicit instruction not to
  follow embedded directives) and MUST NOT be able to authorize a consequential action (submitting
  an application, changing account state) on its own. Decisions gating a consequential action MUST
  be made by deterministic code, not by an LLM call, wherever the decision can be expressed as one.
- **No secrets in version control**: API keys, database credentials, and encryption keys MUST live
  only in untracked `.env` files or a secrets manager, never in a committed file — including
  `.env.example`, which documents variable names only, never real values.

**Rationale**: The backend is not a thin API layer bolted onto the iOS app — it holds encrypted CV
data, drives outbound requests to third-party services on a user's behalf, and is the system a
compromised or adversarial input (a malicious CV, a hostile job posting) would actually reach. It
needs the same rigor as the client, with rules shaped by where backend code actually fails: a
mocked-out database hiding a broken query, an assumed API shape that was never real, and untrusted
text being treated as trusted instructions.

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
- [ ] Backend: `api/jest.config.js` coverage thresholds pass against a real PostgreSQL database,
      not a mocked one.
- [ ] Backend: any new call to an external API is backed by a live-verified request/response
      shape, not an assumption — cite the doc or call that confirmed it.
- [ ] Backend: any new or changed prompt sent to an LLM keeps untrusted external text clearly
      delimited as data, and no consequential action is gated on the LLM's output alone.

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
TODOs (UX standards, toolchain) can be resolved.

**Version**: 1.1.0 | **Ratified**: 2026-08-28 | **Last Amended**: 2026-09-01
