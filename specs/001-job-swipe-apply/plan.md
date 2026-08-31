# Implementation Plan: Swipe-to-Apply Job Search — Phase 1 (iOS + Local Server)

**Branch**: `001-job-swipe-apply` | **Date**: 2026-08-31 | **Revised**: 2026-08-31 (rev 3) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-job-swipe-apply/spec.md`

**Design detail**: [SDD.md](./SDD.md) — component design, flows, risk register, and the
finding-by-finding record of what changed in rev 2 and why.

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Deliver **Swipe2Work**, a swipe-to-apply job search app for the **Hong Kong and Taiwan** markets:
a native iOS client backed by a purpose-built local API + worker. The API owns all app data
(profiles, swipes, applications, status) in PostgreSQL and is the single integration point for the
iOS app.

**career-ops is a design reference, not a runtime dependency** — nothing of it is deployed. It
contributes reconnaissance (which HK/TW job endpoints are public and stable), a provider doctrine
worth copying, a status vocabulary, and the sensitive-field carve-out. We build the scrapers, the
submitter, the CV parser, and the tracker.

Phase 1 is local infrastructure only: Dockerized Node/Express/PostgreSQL reachable from a physical
device over ngrok. Cloud deployment is deferred, which means Phase 1 produces a device demo, not a
distributable build.

## Technical Context

**Language/Version**: Swift 6 (iOS client) / TypeScript on **Node.js 22 LTS** (server)

**Primary Dependencies**: SwiftUI, native `URLSession`-based API client aligned to the OpenAPI spec
(iOS); Express, Prisma ORM, a job queue, an LLM SDK (Gemini or OpenAI-compatible), a PDF text
extractor + DOCX reader, a CJK segmenter, Firecrawl for JS-gated pages only, Playwright chromium
once Tier-2 sourcing needs it (server)

**Storage**: PostgreSQL 16, Dockerized with a local named volume; Prisma manages schema via
migrations. No client-side database — the iOS app is a thin client over the API (ephemeral
`URLCache`/in-memory state only).

**Testing**: XCTest (unit + UI) and swift-snapshot-testing for the iOS client, per the
constitution's Test-First and snapshot-testing requirements; Jest + Supertest for the Express API,
with contract tests run against the OpenAPI spec (resolved in `research.md` — no prior server
code existed in this repo to infer a convention from, so Jest/Supertest was chosen as the
standard pairing for Express/TypeScript).

**Target Platform**: iOS 17.0+ (client); Linux container via Docker (server), run locally for
Phase 1.

**Project Type**: Mobile + API (iOS client + backend service) — see Project Structure below.

**Performance Goals**: Meets constitution Principle IV verbatim — cold launch ≤ 2s, screen
transitions ≤ 300ms, no main-thread I/O. Server-side target: p95 API response ≤ 300ms for feed/
status reads on local hardware (no server-side performance principles exist yet in the
constitution; this is a Phase 1 working target, not a hard gate).

**Constraints**: Client network calls MUST define explicit timeouts (30s connect / 60s read per
constitution) with exponential backoff and cancellation on view exit. API payloads MUST carry no
iOS-specific fields/types, so the same contract can serve a future Android client without
breaking change (per the user-supplied Migration Controls). Additional constraints surfaced by the
career-ops source review (see [SDD §2](./SDD.md#2-design-drivers)):

- **Submission is asynchronous.** A right-swipe returns `202` immediately; the attempt (30s–2min)
  runs on the worker. Nothing that touches a browser or an LLM sits on a request path.
- **No credential custody.** No employer-site or platform passwords are stored anywhere.
- **Sourcing never runs on a request path.** Crawls are scheduled into Postgres; the feed is a
  database read, so no external board can slow a swipe.
- **Every provider pins a host allowlist** before fetching, and honours robots.txt, crawl-delay,
  and 429 backoff. A source that blocks automated access is dropped, never circumvented.
- **CJK correctness.** Keyword extraction must segment Traditional Chinese before matching;
  whitespace tokenisation silently under-extracts rather than failing.

**Scale/Scope**: Single developer machine, multi-user-capable schema, for Phase 1 (no load testing
in scope). 4 user stories: profile/CV, swipe feed, prepare-and-apply, status tracking — roughly
12-14 screens/flows on iOS, ~15 REST endpoints, and ~5 job sources at launch (2 reused from
career-ops, ~1-3 built for Taiwan).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution (`.specify/memory/constitution.md`) is scoped to the iOS client; it has
no server-side principles yet. Gates below are evaluated for the iOS client as written, and the
same principles are adopted as working conventions for the server pending a constitution update.

| Principle | Gate | Status | Notes |
|---|---|---|---|
| I. Code Quality | SRP, readability, no dead code, minimal deps, complexity ≤10, `let`-first | **PASS** | MVVM with `@Observable` view models keeps view/business-logic responsibilities separated; Express layer will mirror this with routes/services/data-access separation. |
| II. Test-First | TDD, ≥80% unit coverage, UI tests on critical flows, snapshot tests, real-framework tests, CI-blocking | **PASS (planned)** | XCTest unit + UI tests planned per user story; snapshot tests for job-card/swipe UI; Jest/Supertest for the API, resolved in `research.md`. **Rev 2**: fixtures must include zh-Hant CVs and JDs with asserted non-empty extraction, so silent CJK under-extraction fails a test instead of shipping. |
| III. UX Consistency | Design tokens, all states (loading/empty/error/success), a11y, 300ms animations, iOS HIG | **PASS (planned)** | Swipe feed, profile review, and tracking views must each implement all four states — the feed's empty state is load-bearing here, since a two-city market will run dry. `TODO(UIUX_STANDARDS)` means token values are still undefined — a dependency, not a blocker. **Added in rev 2**: a11y and snapshot coverage must include **zh-Hant at large Dynamic Type sizes**, not English at default only; CJK line-breaking and truncation on job cards behave differently from Latin text. |
| IV. Performance | Cold launch ≤2s, transitions ≤300ms, off-main-thread I/O, ≤150MB memory, cached/off-thread image decode, no polling, timeouts+backoff | **PASS (planned)** | All network calls go through the URLSession client on background queues. **Rev 2**: the no-polling rule is what forces APNs — a pull-only design cannot satisfy FR-029's "notify the user when an application needs attention", so push is a constitutional consequence, not a nice-to-have. Feed pre-fetches the next N cards so a swipe never awaits the network; the 300ms budget is also why submission had to become asynchronous. |
| V. iOS Platform Standards | iOS 17+/18, no private APIs, privacy-by-design, App Store compliance, device scope | **CONDITIONAL PASS** | CV upload uses the standard document picker (no elevated permissions); `PrivacyInfo.xcprivacy` required since the app collects CV/PII; push permission requested contextually at first right-swipe, not at launch. iPhone portrait+landscape; iPad out of scope until `TODO(UIUX_STANDARDS)` resolves. **Condition (rev 2)**: App Store compliance for automated application submission must be assessed against the Review Guidelines *before* the auto-submit component is built — see [SDD §12 R1](./SDD.md#12-risk-register). Auto-submit is deliberately scoped to allowlisted public ATS endpoints with no credential custody, and excludes LinkedIn/Indeed entirely, to keep this passable. |

**Gate result: PASS with two recorded gaps** (justified in Complexity Tracking below):

1. The constitution governs iOS only; this feature ships a backend it says nothing about.
2. Principle V's App Store compliance clause needs an explicit pre-build assessment for the
   auto-submit capability rather than an assumed pass.

Neither blocks planning, but both must close before implementation — gap 1 via
`/speckit-constitution`, gap 2 via a Review Guidelines assessment.

**Constitution TODO resolved by this plan**: `TODO(MIN_IOS_VERSION)` → **iOS 17.0**, set by
`@Observable`'s availability. Note this is *broader* than Principle V's "current and previous major
version" policy; supporting a third version is a deliberate install-base choice and should be
written into the constitution rather than left as drift.

## Project Structure

### Documentation (this feature)

```text
specs/001-job-swipe-apply/
├── spec.md              # Feature specification (rev 2)
├── plan.md              # This file (/speckit-plan command output)
├── SDD.md               # Software Design Document — component design, flows, risks, review record
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
├── checklists/          # Specification quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Option 3: Mobile + API
api/
├── src/
│   ├── routes/            # auth, profile, cv, feed, swipes, applications, questions, devices
│   ├── sourcing/
│   │   ├── providers/     # OUR providers: tw104, tw1111, cake, meetjobs, ctgoodjobs
│   │   ├── jobsdb-hk.ts   # SEEK v5 public API, siteKey HK-Main
│   │   ├── yourator.ts    # yourator.co public JSON API v4
│   │   ├── firecrawl.ts   # JS-gated pages only; never sees CV/PII
│   │   └── normalise.ts   # → canonical JobPosting; dedup on employer ATS URL
│   ├── matching/
│   │   ├── segment.ts     # CJK (zh-Hant) segmentation + EN tokenisation
│   │   ├── taxonomy/      # bilingual skill synonyms (專案管理 ↔ project management)
│   │   └── rank.ts        # deterministic pre-rank; LLM eval on intent only
│   ├── apply/
│   │   ├── prefill.ts     # form fields → proposed answers
│   │   ├── submit-ats.ts  # OUR submitter — allowlisted ATS only
│   │   ├── sensitive.ts   # carve-out: visa/work-auth/ID/salary/demographic → never auto-answer
│   │   └── handoff.ts     # non-allowlisted → answer sheet + deep link
│   ├── cv/
│   │   ├── extract.ts     # PDF text layer + DOCX; rejects scanned (no OCR in Phase 1)
│   │   └── interpret.ts   # LLM → keywords + YoE, per detected language
│   ├── llm/               # direct SDK calls; prompt patterns informed by career-ops modes/
│   ├── queue/             # crawl, parse-cv, rebuild-match, submit
│   ├── models/            # Prisma client + domain mappers
│   ├── middleware/        # auth, validation, rate limits, error mapping
│   ├── server.ts
│   └── worker.ts
├── prisma/{schema.prisma, migrations/}
├── tests/{contract/, integration/, unit/}
├── Dockerfile             # Node 22 LTS + pdf text extractor
└── docker-compose.yml     # postgres + api + worker, local named volume

ios/
├── Swipe2Work/
│   ├── App/                    # entry point, BaseURLProvider (DEBUG: localhost|ngrok, RELEASE: cloud)
│   ├── Features/
│   │   ├── Profile/            # CV upload, keyword/YoE review + edit
│   │   ├── JobFeed/            # swipe deck (left = reject, right = apply)
│   │   ├── ApplicationTracking/# list, detail/timeline, answer-sheet review, pending questions
│   │   └── Settings/           # submission mode, markets, language, caps
│   ├── Core/
│   │   ├── Networking/         # URLSession API client, OpenAPI-aligned models
│   │   ├── Models/             # Job, Application, Profile, Swipe, AnswerSheet
│   │   ├── DesignSystem/       # tokens, shared components (pending TODO(UIUX_STANDARDS))
│   │   └── Localization/       # en + zh-Hant
│   └── Resources/{en.lproj, zh-Hant.lproj}/
└── Swipe2WorkTests/
    ├── Unit/
    ├── Snapshot/               # incl. zh-Hant at large Dynamic Type sizes
    └── UITests/
```

**Structure Decision**: Option 3 (Mobile + API), matching the user-supplied Phase 1 architecture:
`api/` hosts the Dockerized Node/Express/PostgreSQL/Prisma service plus a worker process from the
same image; `ios/Swipe2Work/` hosts the SwiftUI client, with its test target nested inside `ios/`
(rev 2 fix — it was previously dedented out of the app tree). The two communicate exclusively over
the OpenAPI-aligned REST contract in `contracts/`, with the base URL switched by build
configuration (DEBUG → localhost or ngrok tunnel, RELEASE → future cloud endpoint) per the
user-supplied Migration Controls.

`sourcing/` and `apply/` are both ours end to end (rev 3): we write every provider and the
submitter. There is no career-ops module — see [SDD §6.6](./SDD.md#66-what-we-took-from-career-ops-and-what-we-left)
for what was inherited as knowledge rather than code.

## Complexity Tracking

| Violation / added complexity | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Backend outside constitutional governance** | The feature cannot exist without a server: sourcing, LLM calls, and submission cannot run on-device | Client-only was rejected — API keys would ship in the binary, and career-ops cannot run on iOS. Mitigation: apply the iOS principles by analogy now, amend the constitution via `/speckit-constitution` before implementation (SDD R7). |
| **We build our own submitter** | Nothing off the shelf submits applications — career-ops refuses by design and its flow needs a headed desktop Chrome window with no mobile analogue | Scoped to allowlisted ATS with published form schemas to keep the surface small; everything else hands off to the user (SDD §6.5). |
| **We build every job provider** | career-ops is a design reference only (rev 3), and it has no mainstream Taiwan coverage regardless | One provider per source behind a common interface. Tier 1 is cheap because the reference documented which endpoints are public and stable; Tier 2 (104.com.tw) is genuine new work (SDD §6.3). |
| **Separate worker process** | Submission takes 30s–2min and would blow the constitution's 300ms transition budget on the request path | In-request submission was the rev 1 design; it is incompatible with Principle IV. |
| **LLM dependency** | Keyword/YoE interpretation, answer drafting, and cross-language relevance are prompt-shaped in career-ops, not algorithmic | A purely deterministic pipeline was rejected — it cannot map a Traditional Chinese CV to English job requirements. Contained: deterministic pre-rank at feed scale, LLM only on user intent (SDD §6.4, §6.7). |
| **Bilingual skill taxonomy + CJK segmentation** (new subsystem) | Chinese has no whitespace word boundaries | Whitespace tokenisation was rejected: on zh-Hant it returns plausible-looking near-empty results rather than failing, making the defect invisible in production (SDD R5). |
| **Firecrawl as an external dependency** | Some target boards are JS-gated and career-ops's providers are plain HTTP | Crawl4AI was considered and deferred: it is Python, so it would add a second runtime and container to a Node/TS stack plus proxy and anti-bot operations. Firecrawl is a call from the existing service. Constraint: it never receives CV or profile PII (SDD §6.3, §10.1). |
