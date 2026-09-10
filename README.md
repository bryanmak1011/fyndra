# Fyndra

A mobile job-search app for **Hong Kong and Taiwan**: upload a CV, get a ranked feed of relevant
roles, swipe left to reject and right to apply. The backend prepares each application from your
profile and either submits it to a supported applicant tracking system or hands you a reviewed
answer sheet to finish yourself.

Backend is built and tested; the iOS app is not started.

## Status

| Phase | Artifact | State |
|---|---|---|
| Specify | [spec.md](specs/001-job-swipe-apply/spec.md) | Draft, rev 3 |
| Plan | [plan.md](specs/001-job-swipe-apply/plan.md) | Draft, rev 3 |
| Design | [SDD.md](specs/001-job-swipe-apply/SDD.md) | Draft, v3 |
| Tasks | [tasks.md](specs/001-job-swipe-apply/tasks.md) | 92 tasks, ~60 done |
| Build | [api/README.md](api/README.md) | Backend (`api/`) complete for all four user stories; iOS has only a Swift package and no Xcode project yet, see [ios/README.md](ios/README.md) |

Auto-submit is currently handoff-only: no ATS platform (Greenhouse included)
exposes a public, third-party submission API without an employer-issued
credential, so every application is prepared as an answer sheet for the user
to submit themselves. See [BLOCKERS.md](specs/001-job-swipe-apply/BLOCKERS.md)
for the full finding and the options it leaves open.

## Documents

Everything lives under [`specs/001-job-swipe-apply/`](specs/001-job-swipe-apply/):

- **[spec.md](specs/001-job-swipe-apply/spec.md)** — what we're building, as user stories and
  testable requirements. No technology.
- **[SDD.md](specs/001-job-swipe-apply/SDD.md)** — the software design document: architecture,
  component design, data flows, security and i18n, risk register.
- **[plan.md](specs/001-job-swipe-apply/plan.md)** — technical plan and constitution compliance.
- **[tasks.md](specs/001-job-swipe-apply/tasks.md)** — 92 dependency-ordered tasks, grouped by
  user story, starting with a compliance gate.
- **[research.md](specs/001-job-swipe-apply/research.md)** — decisions and their rationale.
- **[data-model.md](specs/001-job-swipe-apply/data-model.md)** — entities and state machine.
- **[contracts/openapi.yaml](specs/001-job-swipe-apply/contracts/openapi.yaml)** — the client↔server contract.
- **[quickstart.md](specs/001-job-swipe-apply/quickstart.md)** — how to run and validate it.
- **[.specify/memory/constitution.md](.specify/memory/constitution.md)** — non-negotiable
  engineering principles.

## Shape of the system

- **iOS client** — Swift 6, SwiftUI, MVVM with `@Observable`, iOS 17+. Presentation only. Today
  this is a standalone `FyndraCore` Swift package (API client, contract models) plus an empty
  folder structure — no `.xcodeproj` exists yet, see [ios/README.md](ios/README.md).
- **API + worker** — TypeScript, Express, Prisma, PostgreSQL, in Docker. Owns all data and logic.
  Implemented and tested end to end, see [api/README.md](api/README.md).
- **Job sourcing** — Hong Kong via JobsDB and Taiwan via 104.com.tw, the two dominant boards in
  each market, each sourced through a verified Apify actor rather than a direct fetch (neither
  site has a workable direct-fetch path). Yourator and ATS-tracked-company sourcing were dropped
  entirely on 2026-09-10 in favor of these two market-wide boards.

LinkedIn and Indeed are deliberately excluded: both prohibit automated access.

## Design principles worth knowing up front

- **Auto-submit is allowlist-gated.** Applications are submitted directly only to applicant
  tracking systems with published form schemas. Everything else is prepared and handed to the
  user. In practice, no platform currently qualifies (see Status above), so every application
  goes through handoff today.
- **Sensitive questions are never auto-answered.** Work authorization, visa status, identity
  numbers, expected salary, and demographics always go back to the user.
- **We never store your platform passwords.** Submission targets endpoints that accept an
  application without a candidate login.
- **Sources that block automated access are dropped, not circumvented.** We honour `robots.txt`,
  crawl-delay, and rate limits.
- **Volume is capped.** Per-user daily and per-employer limits, enforced server-side.

## Acknowledgement

Design informed by [career-ops](https://github.com/santifer/career-ops) (MIT) — specifically its
job-source reconnaissance, provider doctrine, application-pipeline vocabulary, and sensitive-field
carve-out. Fyndra ships none of its code and is not affiliated with or endorsed by that
project.
