---

description: "Task list for Fyndra — swipe-to-apply job search (HK/TW), Phase 1"
---

# Tasks: Fyndra — Swipe-to-Apply Job Search (HK/TW)

**Input**: Design documents from `/specs/001-job-swipe-apply/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [SDD.md](./SDD.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml)

**Tests**: Included and **mandatory** — the constitution's Principle II (Test-First) is
non-negotiable, requiring ≥80% coverage, UI tests on critical flows, and snapshot tests.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and demoed
independently. Phase 0 is a compliance gate owned by the Functional Analyst.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- **[FA]**: Owned by the **Functional Analyst** agent, not an engineer
- Include exact file paths in descriptions

## Path Conventions

Mobile + API per [plan.md](./plan.md): `api/src/`, `api/tests/`, `ios/Fyndra/`, `ios/FyndraTests/`

---

## Phase 0: Compliance, Legal & Naming Gate 🚦

**Purpose**: Establish what we are legally and contractually allowed to build, *before* the
sourcing and auto-submit code exists. These are the risks in [SDD §12](./SDD.md#12-risk-register)
(R1, R2, R3, R4) and the open decisions in [SDD Appendix B](./SDD.md#appendix-b-open-decisions).

**Owner**: **Functional Analyst** — this is requirements and policy work, not engineering. The
analyst produces written findings that become acceptance criteria for T020+ and T060+.

**⚠️ BLOCKING**: T001 blocks all Taiwan provider work (T024–T026). T002 blocks all auto-submit
work (T060–T066). T003 blocks CV storage (T030). Everything else may proceed in parallel.

- [X] T001 [P] [FA] Per-source ToS and robots.txt assessment for each planned job source (JobsDB HK, Yourator, 104.com.tw, 1111, Cake, Meet.jobs, CTgoodjobs, cpjobs, and each ATS family) — document for each: does the ToS permit automated access, what does robots.txt allow, is there a published rate limit, and is there an official API alternative. Record a GO/NO-GO per source with the quoted clause supporting it, in `specs/001-job-swipe-apply/compliance/source-assessment.md`
- [X] T002 [P] [FA] App Store Review Guidelines assessment for automated application submission — determine whether submitting employment applications on a user's behalf to allowlisted ATS endpoints is acceptable under the current Guidelines, what disclosure the listing and in-app flow must carry, and what would trigger rejection. Required by constitution Principle V before the submitter is built. Output to `specs/001-job-swipe-apply/compliance/app-store-assessment.md`
- [X] T003 [P] [FA] CV/PII handling policy under **HK PDPO** and **TW PDPA** — define lawful basis, purpose limitation, retention period, the user's access/erasure path, and cross-border transfer position (the LLM provider and Firecrawl are both offshore processors). Specify what may never leave our infrastructure. Output to `specs/001-job-swipe-apply/compliance/privacy-policy-requirements.md`
- [X] T004 [P] [FA] Trademark and attribution clearance — confirm **Swipe2Work** (the product's name at the time; renamed to **Fyndra** 2026-09-01, see status note below) is clear for use as product name, bundle identifier, and store listing; confirm no career-ops mark appears anywhere in the product (career-ops's `TRADEMARK.md` does not licence its name for commercial product naming); define the credit-only attribution wording for adapted MIT-licensed prompt text. Output to `specs/001-job-swipe-apply/compliance/naming-attribution.md`
- [X] T005 [P] [FA] Volume-discipline policy — set the per-user daily submission cap and per-employer cap with a stated rationale, and decide whether `handed_off` applications count toward them (SDD Appendix B6). These become the FR-024 defaults. Output to `specs/001-job-swipe-apply/compliance/volume-policy.md`
- [X] T006 [P] [FA] Sensitive-question taxonomy for HK/TW — enumerate the question classes that must never be auto-answered (work authorization, visa status, HKID / 身分證字號, 期望薪資 / expected salary, demographics), with Traditional Chinese and English phrasings for each, so `apply/sensitive.ts` has a testable specification rather than a prose rule (FR-022). Output to `specs/001-job-swipe-apply/compliance/sensitive-questions.md`
- [X] T007 [FA] Consolidate T001–T006 into a one-page compliance summary with explicit GO/NO-GO per capability (Taiwan sourcing, auto-submit, CV retention, naming), and update [SDD §12](./SDD.md#12-risk-register) risk severities and [Appendix B](./SDD.md#appendix-b-open-decisions) to reflect the findings

**Checkpoint**: Compliance posture documented. Sourcing and auto-submit are unblocked or explicitly
descoped with a written reason.

> **Build status (2026-08-31)** — Not a clean pass. Findings, fully sourced, are in
> [`compliance/`](./compliance/); SDD.md §12 and Appendix B are updated to match. Two results are
> load-bearing enough to flag here directly:
> - **T046 (JobsDB HK provider) — UNBLOCKED, risk accepted.** Its ToS reserves automated access
>   to a documented partner API that isn't the public endpoint the design assumed (SDD R11).
>   Product explicitly accepted this ToS risk on 2026-08-31 rather than pursuing a SEEK
>   partnership — see `compliance/risk-acceptance-log.md`. Built same session.
> - **T088 (104.com.tw provider) stays BLOCKED** — every fetch attempt (robots.txt, ToS,
>   homepage) returned HTTP 403; a human has to read it in a browser (SDD Appendix B9).
> - **Product naming is reopened, not resolved** — the prior name, Swipe2Work, collided with
>   `swipe2work.ai` (Germany), an active, conceptually identical product under nearly the same
>   name. **Update, 2026-09-01**: renamed to **Fyndra** after a wider search found the whole
>   descriptive swipe/hire/career naming category saturated with live competitors — see SDD.md
>   rev 3.2. Do not use "Fyndra" externally (App Store Connect, domain, marketing) until a real
>   trademark clearance search runs (SDD R3, Appendix B4) — internal repo/spec use is fine, and is
>   what this rename covers.
> - **Unblocked and ready**: T047 (Yourator), T048 (ATS-family providers, read side), T030 (CV
>   storage — retention = account deletion + 30 days), T054/T060 (volume caps — 15/day,
>   1/employer, `handed_off` excluded), T063/T058 (sensitive-question carve-out — taxonomy
>   delivered). `api/prisma/schema.prisma`'s `dailySubmissionCap` default is already updated to 15
>   and migrated.
> - cakeresume.com/cake.me and meet.jobs are **not currently tasks** in this file but are flagged
>   NO-GO / moot respectively in case Tier-2 scope expands to them later.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project skeleton for both codebases

- [X] T008 Create the repository structure per [plan.md](./plan.md): `api/`, `ios/`, with the module tree under `api/src/` (routes, sourcing, matching, apply, cv, llm, queue, models, middleware)
- [X] T009 Initialize the TypeScript/Express project in `api/` on **Node 22 LTS** with Express, Prisma, a job queue, and an LLM SDK; commit `api/package.json` and `api/tsconfig.json`
- [X] T010 [P] Create `api/Dockerfile` (Node 22 LTS + `pdftotext`) and `api/docker-compose.yml` with `postgres`, `api`, and `worker` services plus a named volume
- [X] T011 [P] Configure ESLint + Prettier for `api/`, and SwiftLint/swift-format for `ios/`, with the constitution's complexity ceiling of 10 enforced as a lint rule
- [ ] T012 [P] Create the Xcode project `ios/Fyndra.xcodeproj` targeting **iOS 17.0+** with Swift 6, plus the `FyndraTests` unit/snapshot target and a UI test target
- [ ] T013 [P] Configure CI (build, lint, test, coverage gate at 80%, snapshot diff) so a failing test blocks merge per constitution Principle II

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase completes

- [X] T014 Define the Prisma schema in `api/prisma/schema.prisma` for all entities in [data-model.md](./data-model.md) (UserProfile, CvDocument, JobPosting, FeedEntry, JobInteraction, Application, ApplicationStatusEvent, ApplicationQuestion, ProposedAnswer, Device), with the unique constraints on `JobInteraction(profileId, jobPostingId)` and `FeedEntry(profileId, jobPostingId)`
- [X] T015 Generate and apply the initial migration; verify against the Dockerized Postgres
- [X] T016 [P] Implement email + one-time-code auth with opaque bearer tokens (30-day expiry, no refresh endpoint) in `api/src/routes/auth.ts` and `api/src/middleware/auth.ts` (FR-026)
- [X] T017 [P] Implement request validation, error mapping to the `Error` schema, and per-token rate limiting in `api/src/middleware/`
- [X] T018 [P] Implement structured logging with a per-job correlation id in `api/src/lib/logger.ts`, surfaced as `Application.lastAttemptRef` (SDD §10.3)
- [X] T019 [P] Set up the job queue and worker entry point in `api/src/queue/` and `api/src/worker.ts` with handlers registered for crawl, parse-cv, rebuild-match, and submit
- [X] T020 [P] Implement the environment/config loader in `api/src/config/` reading `DATABASE_URL`, LLM keys, and `FIRECRAWL_API_KEY`, failing fast on missing required values
- [X] T021 [P] Implement the iOS API client foundation in `ios/Fyndra/Core/Networking/` — `URLSession` with 30s connect / 60s read timeouts, exponential backoff, request cancellation on view exit, and bearer-token injection (constitution IV)
- [X] T022 [P] Implement `BaseURLProvider` in `ios/Fyndra/App/` switching DEBUG (localhost or `NGROK_BASE_URL`) vs RELEASE (cloud), per the Migration Controls
- [ ] T023 [P] Create the design-token layer and localization scaffolding (`en`, `zh-Hant`) in `ios/Fyndra/Core/DesignSystem/` and `Core/Localization/` (FR-028)
- [X] T024 [P] Contract-test harness in `api/tests/contract/` validating live responses against `contracts/openapi.yaml`

**Checkpoint**: Auth works, schema is live, queue runs, client can call the API

> **Build status (2026-08-31)** — Phases 1–2 executed for real: `npm install` run,
> migrations applied against a live local Postgres (`brew install postgresql@16`), the
> `api` server boots and serves `/v1/health`, `/v1/auth/*`, `/v1/devices` over real HTTP,
> and `npm test` passes 8/8 against that database. `ios/FyndraCore` (Swift 6, no
> SwiftUI/UIKit) builds clean with `swift build`. Deviations from the task text, and why:
> - **T009**: Express + Prisma installed; the queue is Postgres-backed (see the
>   `ponytail:` note on `QueueJob` in `schema.prisma`) rather than a separate library; no
>   LLM SDK added yet — ponytail: don't install a dependency with no calling code, add it
>   with T033 (CV interpretation) once something actually imports it.
> - **T012/T013**: **not done** — this environment has Xcode Command Line Tools only (no
>   Xcode.app, no iOS SDK, `xcrun --sdk iphonesimulator` fails), so no `.xcodeproj` could
>   be generated and no CI was configured against it. See `ios/README.md` for the exact
>   manual step needed (File → New → Project in real Xcode).
> - **T019**: queue mechanism (enqueue/dequeue/retry, `SELECT ... FOR UPDATE SKIP LOCKED`)
>   is built and correct; no handlers are *registered* yet — ponytail: an empty handler
>   stub with no logic is scaffolding, not infrastructure. Handlers register as each is
>   built (T034, T052, T069).
> - **T021/T022**: implemented in a new `ios/FyndraCore` Swift Package (not directly
>   under `ios/Fyndra/Core/`) specifically so they're buildable and unit-testable
>   without Xcode. `APIClientTests.swift` exists and is complete but **could not be run**
>   in this environment — neither `XCTest` nor `Testing` (swift-testing) is available
>   standalone under Command Line Tools. `swift build` passing is real signal (it compiles
>   and type-checks); the tests need a real Xcode run to confirm they pass.
> - **T023**: **not done**, deliberately — no Feature screen exists yet to consume design
>   tokens or localized strings, so authoring them now would be exactly the
>   "boilerplate/scaffolding for later" ponytail says to skip. Build it alongside the
>   first screen that needs it (T036, US1).
> - **T024**: contract tests exist and hit real endpoints with real assertions
>   (`tests/contract/auth.test.ts`, 8 tests), but this is manual assertion, not a generic
>   schema-validating harness that diffs every response against `openapi.yaml`
>   automatically — lighter-weight than the task literally describes; upgrade path is a
>   library like `express-openapi-validator` if the manual approach stops scaling.
>
> Not started: Phase 0 (compliance — dispatched to a background research agent, not yet
> returned) and Phases 3–7 (US1–US4, Polish — 68 tasks, T025–T092).

---

## Phase 3: User Story 1 — Upload CV and build a profile (Priority: P1) 🎯 MVP

**Goal**: A user uploads a CV in English or Traditional Chinese and gets a reviewable profile of
skill keywords and years of experience.

**Independent Test**: Upload a PDF and a DOCX; confirm extracted keywords and YoE appear, are
editable, and persist. Confirm a scanned PDF is rejected by reason.

### Tests for User Story 1 ⚠️ Write first, confirm they fail

- [ ] T025 [P] [US1] Contract test for `POST /profile/cv`, `GET /profile/cv`, `GET/PATCH /profile` in `api/tests/contract/profile.test.ts`
- [ ] T026 [P] [US1] Unit tests for text extraction in `api/tests/unit/cv-extract.test.ts` — text-layer PDF succeeds, **DOCX succeeds**, scanned PDF returns `no_text_layer`, password-protected returns `password_protected`
- [ ] T027 [P] [US1] Unit tests for CJK extraction in `api/tests/unit/cv-interpret-zhhant.test.ts` — a Traditional Chinese CV fixture MUST yield **non-empty** keywords and a YoE parsed from forms like `5 年以上工作經驗`. An empty result is a failure, not a pass (SDD R5)
- [ ] T028 [P] [US1] Integration test for the full intake journey in `api/tests/integration/cv-intake.test.ts`
- [ ] T029 [P] [US1] Snapshot tests for the profile-review screen in `ios/FyndraTests/Snapshot/ProfileReviewTests.swift` — **including zh-Hant at the largest Dynamic Type size** (constitution III)

### Implementation for User Story 1

- [ ] T030 [US1] Implement CV storage in `api/src/cv/storage.ts` — PII-partitioned, encrypted at rest, own retention clock, single-operation delete (depends on T003's retention decision)
- [ ] T031 [P] [US1] Implement text extraction in `api/src/cv/extract.ts` — PDF text layer via `pdftotext`, DOCX in-process; synchronous format validation returning `422` with a specific code
- [ ] T032 [P] [US1] Implement CJK/Latin language detection and segmentation in `api/src/matching/segment.ts` (jieba-class or ICU for zh-Hant)
- [ ] T033 [US1] Implement LLM CV interpretation in `api/src/cv/interpret.ts` — keywords + YoE, language-aware, prompt structure adapted from career-ops `modes/intake.md` with attribution (depends on T031, T032)
- [ ] T034 [US1] Implement the `parse-cv` queue handler in `api/src/queue/parse-cv.ts` writing `CvDocument.parseStatus` and raw extraction
- [ ] T035 [US1] Implement `POST /profile/cv`, `GET /profile/cv`, `GET /profile`, `PATCH /profile` in `api/src/routes/profile.ts` — corrections applied only on user confirmation, never silently (FR-003)
- [ ] T036 [P] [US1] Implement the CV upload view + view model in `ios/Fyndra/Features/Profile/` with document picker, all four states (loading/empty/error/success)
- [ ] T037 [US1] Implement the keyword/YoE review-and-edit view in `ios/Fyndra/Features/Profile/` (depends on T036)

**Checkpoint**: User Story 1 fully functional and independently demoable

---

## Phase 4: User Story 2 — Swipe through matched jobs (Priority: P1) 🎯 MVP

**Goal**: A ranked HK/TW job feed the user swipes left to reject or right to apply.

**Independent Test**: Seed postings, open the feed, confirm ranking and bilingual rendering; swipe
left (never returns) and right (acknowledged immediately); confirm the end-of-feed state.

### Tests for User Story 2 ⚠️ Write first, confirm they fail

- [ ] T038 [P] [US2] Contract test for `GET /jobs/feed` and `POST /jobs/{jobId}/swipe` in `api/tests/contract/feed.test.ts`
- [ ] T039 [P] [US2] Provider contract tests with recorded fixtures in `api/tests/unit/providers/` — one per provider, asserting normalisation and host-allowlist enforcement
- [ ] T040 [P] [US2] Unit test for employer-URL de-duplication in `api/tests/unit/dedup.test.ts` — the same role from two providers collapses to one posting (FR-016b)
- [ ] T041 [P] [US2] Unit tests for cross-lingual ranking in `api/tests/unit/rank.test.ts` — an English CV matches a zh-Hant JD via the bilingual taxonomy
- [ ] T042 [P] [US2] Integration test for feed exclusion of swiped jobs and idempotent re-swipe in `api/tests/integration/swipe.test.ts` (FR-014)
- [ ] T043 [P] [US2] Snapshot tests for the swipe card and end-of-feed state in `ios/FyndraTests/Snapshot/JobFeedTests.swift` — zh-Hant titles at large Dynamic Type must not clip
- [ ] T044 [P] [US2] UI test for the swipe gestures in `ios/FyndraTests/UITests/SwipeFeedUITests.swift` (constitution II: critical flow)

### Implementation for User Story 2

- [X] T045 [P] [US2] Define the provider interface and the source-rule enforcement layer in `api/src/sourcing/provider.ts` — host allowlist, robots.txt, crawl-delay, 429 backoff, and a hard prohibition on circumventing bot protection (FR-016a)
- [ ] T046 [P] [US2] Implement the JobsDB Hong Kong provider in `api/src/sourcing/providers/jobsdb-hk.ts` against SEEK's public v5 search API with `siteKey=HK-Main` — **attempted 2026-08-31, incomplete**: a plain POST returned `Cannot POST`, and probing further (alternate request shapes/headers) was blocked by the coding tool's own safety classifier before establishing the correct request shape. See `compliance/risk-acceptance-log.md` — investigate the correct API contract through documentation or a browser network trace, not further probing, before resuming this task.
- [X] T047 [P] [US2] Implement the Yourator provider in `api/src/sourcing/providers/yourator.ts` against the public `api/v4/jobs`, preferring each row's employer ATS URL as the dedup key and stripping `utm_*`
- [ ] T048 [P] [US2] Implement the ATS-family providers in `api/src/sourcing/providers/ats/` (Greenhouse, Lever, Ashby, Workable) filtered to HK/TW locations
- [ ] T049 [US2] Implement normalisation and de-duplication in `api/src/sourcing/normalise.ts` — canonical `JobPosting`, dedup on `employerApplyUrl`, language and market detection (depends on T045)
- [ ] T050 [US2] Implement the bilingual skill taxonomy in `api/src/matching/taxonomy/` with zh-Hant ↔ English skill and title pairs
- [ ] T051 [US2] Implement deterministic ranking in `api/src/matching/rank.ts` writing `FeedEntry` rows — keyword overlap, title/role match, YoE band, market. No LLM at feed scale (depends on T032, T050)
- [ ] T052 [US2] Implement the `crawl` and `rebuild-match` queue handlers in `api/src/queue/` on a schedule, plus liveness re-check before a card is served
- [ ] T053 [US2] Implement `GET /jobs/feed` in `api/src/routes/feed.ts` — Postgres-only read, excludes swiped postings, returns `exhausted` (FR-004a)
- [ ] T054 [US2] Implement `POST /jobs/{jobId}/swipe` in `api/src/routes/swipes.ts` — upsert `JobInteraction`, create a `queued` Application on right-swipe, return `202` immediately, `409` when a cap is already spent (FR-023, FR-024)
- [ ] T055 [P] [US2] Implement the swipe deck view + view model in `ios/Fyndra/Features/JobFeed/` with card pre-fetching so a swipe never awaits the network
- [ ] T056 [US2] Implement the end-of-feed and broaden-criteria states in `ios/Fyndra/Features/JobFeed/` (depends on T055)

**Checkpoint**: MVP complete — upload a CV, swipe a real HK/TW feed

---

## Phase 5: User Story 3 — Automated job application (Priority: P2)

**Goal**: A right-swipe produces a prepared application that is either submitted directly to an
allowlisted ATS or handed to the user with a reviewed answer sheet.

**Independent Test**: Right-swipe an allowlisted posting in auto-submit mode → submitted. Right-swipe
a non-allowlisted one → falls back to review. A sensitive question always blocks.

### Tests for User Story 3 ⚠️ Write first, confirm they fail

- [ ] T057 [P] [US3] Contract tests for `POST /applications/{id}/confirm`, `/handoff-complete`, and `/questions/{qid}/answer` in `api/tests/contract/applications.test.ts`
- [ ] T058 [P] [US3] Unit tests for the sensitive-field carve-out in `api/tests/unit/sensitive.test.ts` — every class from T006, in both languages, must force `pending_needs_answer` in **both** submission modes and must never be reused (FR-022)
- [ ] T059 [P] [US3] Unit tests for the allowlist gate in `api/tests/unit/apply-route.test.ts` — a non-allowlisted posting in auto-submit mode routes to `awaiting_review`, never to a submission attempt (FR-009)
- [ ] T060 [P] [US3] Unit tests for volume caps in `api/tests/unit/caps.test.ts` — cap already spent → `409` at swipe; cap crossed while queued → `awaiting_review` with `cap_reached`
- [ ] T061 [P] [US3] Integration test for the full state machine in `api/tests/integration/apply-flow.test.ts` covering every transition in [data-model.md](./data-model.md)
- [ ] T062 [P] [US3] Snapshot tests for the answer-sheet review and pending-question screens in `ios/FyndraTests/Snapshot/ApplyTests.swift`

### Implementation for User Story 3

- [ ] T063 [US3] Implement the sensitive-question classifier in `api/src/apply/sensitive.ts` from T006's taxonomy — bilingual, testable, fail-closed (an unclassifiable question is treated as sensitive)
- [ ] T064 [P] [US3] Implement ATS form-schema readers in `api/src/apply/schemas/` for Greenhouse, Lever, Ashby, Workable
- [ ] T065 [US3] Implement answer prefill in `api/src/apply/prefill.ts` — profile/CV mapping plus LLM drafting for free-text fields, producing `ProposedAnswer` rows with a `source` for each (depends on T063, T064)
- [ ] T066 [US3] Implement answer reuse in `api/src/apply/answer-reuse.ts` keyed on `(profileId, questionFingerprint)`, excluding sensitive questions (FR-021, FR-022)
- [ ] T067 [US3] Implement the ATS submitter in `api/src/apply/submit-ats.ts` — allowlist-gated only, with CAPTCHA and multi-step detection producing classified `failureReason` values (depends on T002's GO, T064)
- [ ] T068 [US3] Implement the handoff path in `api/src/apply/handoff.ts` — answer sheet plus employer form URL for non-allowlisted postings (FR-025)
- [ ] T069 [US3] Implement the `submit` queue handler and the Application state machine in `api/src/apply/state-machine.ts`, enforcing every guard in [data-model.md](./data-model.md) (depends on T063, T065, T067, T068)
- [ ] T070 [US3] Implement `POST /applications/{id}/confirm`, `/handoff-complete`, `/questions/{qid}/answer` in `api/src/routes/applications.ts`
- [ ] T071 [P] [US3] Implement the answer-sheet review UI in `ios/Fyndra/Features/ApplicationTracking/` — per-field proposed answer, source label, inline edit
- [ ] T072 [P] [US3] Implement the pending-question UI in `ios/Fyndra/Features/ApplicationTracking/`, explaining *why* a sensitive question must be answered by the user
- [ ] T073 [US3] Implement the submission-mode setting and cap display in `ios/Fyndra/Features/Settings/` — default review-before-sending, auto-submit as an informed opt-in (FR-018, FR-019)

**Checkpoint**: Applications are prepared and submitted or handed off, with safety rules enforced

---

## Phase 6: User Story 4 — Track application status (Priority: P2)

**Goal**: The user sees every application's current status and can advance it as employers respond.

**Independent Test**: Submit applications, open the tracking list, confirm statuses and timeline;
mark one `interview` and confirm it persists; confirm an illegal transition is rejected.

### Tests for User Story 4 ⚠️ Write first, confirm they fail

- [ ] T074 [P] [US4] Contract tests for `GET /applications`, `GET /applications/{id}`, `POST /applications/{id}/status` in `api/tests/contract/tracking.test.ts`
- [ ] T075 [P] [US4] Unit tests for legal post-submission transitions in `api/tests/unit/status-transitions.test.ts` — `hired` from `queued` must return `409`
- [ ] T076 [P] [US4] Snapshot tests for the tracking list and detail timeline in `ios/FyndraTests/Snapshot/TrackingTests.swift`

### Implementation for User Story 4

- [ ] T077 [P] [US4] Implement `GET /applications` with status filtering and `GET /applications/{id}` with status history in `api/src/routes/applications.ts`
- [ ] T078 [US4] Implement `POST /applications/{id}/status` for user-reported progression, validating transitions and appending an `ApplicationStatusEvent` (FR-011a)
- [ ] T079 [P] [US4] Implement APNs push from the worker in `api/src/notifications/` for `pending_needs_answer`, `needs_attention`, and terminal statuses, plus `POST /devices` (FR-029)
- [ ] T080 [P] [US4] Implement the tracking list view + view model in `ios/Fyndra/Features/ApplicationTracking/`
- [ ] T081 [US4] Implement the application detail timeline and the status-update control in `ios/Fyndra/Features/ApplicationTracking/` (depends on T080)
- [ ] T082 [US4] Implement push-permission request at first right-swipe (contextual, not at launch) and in-app badge fallback in `ios/Fyndra/` (constitution V)

**Checkpoint**: All four user stories independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T083 [P] Add `ios/Fyndra/PrivacyInfo.xcprivacy` and the in-app privacy disclosure per T003's findings (constitution V)
- [ ] T084 [P] VoiceOver labels and 44×44pt tap targets across all screens, verified on a device (constitution III)
- [ ] T085 [P] Instruments pass — cold launch ≤2s, transitions ≤300ms, ≤150MB resident, no main-thread hangs or retain cycles (constitution IV)
- [ ] T086 [P] Prompt-injection hardening — JD text is data, never instruction, and can never authorise a submission (SDD §10.1)
- [ ] T087 [P] Firecrawl integration in `api/src/sourcing/firecrawl.ts` for JS-gated sources only, with an assertion that no CV or profile PII is ever sent
- [ ] T088 Implement the 104.com.tw provider in `api/src/sourcing/providers/tw104.ts` (**gated on T001's GO for this source**)
- [ ] T089 [P] Coverage audit to ≥80% on business logic, view models, and services; close any gap (constitution II)
- [ ] T090 [P] Update `CLAUDE.md` and add `api/README.md` + `ios/README.md` with setup and architecture pointers
- [ ] T091 Run the full [quickstart.md](./quickstart.md) validation end-to-end on a physical device over ngrok
- [ ] T092 Run `/speckit-constitution` to add backend engineering principles — the constitution is iOS-only and this feature ships a server (SDD R7)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Compliance)**: no dependencies; start immediately, runs in parallel with Setup
- **Phase 1 (Setup)**: no dependencies
- **Phase 2 (Foundational)**: depends on Setup — **blocks all user stories**
- **Phase 3 (US1)** and **Phase 4 (US2)**: depend on Foundational; together form the MVP
- **Phase 5 (US3)**: depends on Foundational + US2 (needs postings to apply to) + **T002 GO**
- **Phase 6 (US4)**: depends on Foundational + US3 (needs applications to track)
- **Phase 7 (Polish)**: depends on the desired stories being complete

### Critical compliance gates

| Gate | Blocks | Reason |
|---|---|---|
| T001 GO per source | T046–T048, T088 | Do not scrape a source before knowing its ToS permits it |
| T002 GO | T067, T073 | Constitution V requires the App Store assessment before building auto-submit |
| T003 retention policy | T030 | Cannot design CV storage without knowing the retention obligation |
| T005 caps | T054, T060 | FR-024 defaults are a policy decision, not an engineering guess |
| T006 taxonomy | T063, T058 | The carve-out needs a testable specification, not prose |

### Within Each User Story

Tests written and failing → models → services → endpoints → UI → integration.

### Parallel Opportunities

- All of Phase 0 (T001–T006) runs in parallel, and in parallel with Phase 1
- T010–T013 in parallel; T016–T024 in parallel
- Providers T046, T047, T048 in parallel (different files, common interface)
- iOS and API work within a story proceeds in parallel once the contract is fixed

---

## Parallel Example: Phase 0 + Setup

```bash
# Functional Analyst works the compliance gate while engineering scaffolds:
Task: "T001 Per-source ToS and robots assessment"        # functional-analyst
Task: "T002 App Store Guidelines assessment"             # functional-analyst
Task: "T003 PDPO/PDPA CV retention policy"               # functional-analyst
Task: "T008 Create repository structure"                 # developer
Task: "T012 Create Xcode project"                        # developer
```

## Parallel Example: User Story 2 providers

```bash
Task: "T046 JobsDB Hong Kong provider in api/src/sourcing/providers/jobsdb-hk.ts"
Task: "T047 Yourator provider in api/src/sourcing/providers/yourator.ts"
Task: "T048 ATS-family providers in api/src/sourcing/providers/ats/"
```

---

## Implementation Strategy

### MVP (User Stories 1 + 2)

1. Phase 0 compliance gate in parallel with Phase 1 Setup
2. Phase 2 Foundational — blocks everything
3. Phase 3 (US1) + Phase 4 (US2)
4. **STOP and VALIDATE**: upload a CV, swipe a real HK/TW feed on a device
5. Demo

Both P1 stories are needed for a meaningful MVP: US1 alone is a CV parser, US2 alone has nothing
to rank against.

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. + US1 + US2 → **MVP**, device demo
3. + US3 → applications actually get submitted
4. + US4 → the loop closes
5. + Polish → constitution quality gates met

### Notes

- [P] = different files, no dependencies
- Phase 0 output becomes acceptance criteria for the tasks it gates — not a document filed away
- Commit after each task or logical group
- Verify tests fail before implementing (constitution II, non-negotiable)
- Phase 1 produces a **device demo, not a distributable build** — RELEASE has no cloud endpoint
  until Phase 2 (SDD §11.3)
