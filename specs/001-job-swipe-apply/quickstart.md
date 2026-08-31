# Quickstart: Swipe-to-Apply Job Search (Phase 1)

Validates the iOS + local server slice end-to-end. See [data-model.md](./data-model.md) for
entity detail and [contracts/openapi.yaml](./contracts/openapi.yaml) for the full API contract.

## Prerequisites

- Docker Desktop running
- Xcode 16+ (Swift 6 toolchain), iOS 17+ Simulator installed
- **Node.js 22 LTS** + npm
- A PDF text extractor available in the API image (`pdftotext`) — DOCX is read in-process
- `ngrok` CLI authenticated (only needed for physical-device testing)
- An LLM API key (`GEMINI_API_KEY` or an OpenAI-compatible `OPENAI_API_KEY` + `OPENAI_BASE_URL`) —
  required for CV keyword/YoE interpretation and answer drafting
- Optional: `FIRECRAWL_API_KEY`, only needed once a JS-gated Taiwan source is onboarded

> career-ops is **not** a runtime dependency — nothing to clone, mount, or install. It is a design
> reference; see [SDD §6.6](./SDD.md#66-what-we-took-from-career-ops-and-what-we-left).

## 1. Start the server

```bash
cd api
cp .env.example .env        # DATABASE_URL, LLM key, optional FIRECRAWL_API_KEY
docker compose up -d postgres
npx prisma migrate deploy
npm run dev                 # Express on http://localhost:3000
npm run worker              # separate process: crawl, parse, submit, sync
```

Expected: `GET http://localhost:3000/v1/profile` returns `401` (no bearer token) rather than a
connection error — confirms the API, auth middleware, and DB are wired up.

## 1b. Authenticate

```bash
curl -X POST localhost:3000/v1/auth/request-code -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com"}'
# code is printed to the dev server log in DEBUG
curl -X POST localhost:3000/v1/auth/verify -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","code":"123456"}'
```

Export the returned token as `$TOKEN` for the curl checks below, then register for push so the
pending-question and needs-attention notifications in step 6 arrive:

```bash
curl -X POST localhost:3000/v1/devices -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"pushToken":"<apns-token>","platform":"apns"}'
```

## 1c. Enable the HK/TW job sources

Providers are ours, configured in `api/config/sources.yml`:

```yaml
- id: jobsdb-hk           # Hong Kong's dominant board
  provider: jobsdb-hk     # SEEK v5 public search API
  api: https://hk.jobsdb.com/api/jobsearch/v5/search
  siteKey: HK-Main
  market: HK
  enabled: true

- id: yourator            # Taiwan startup / digital roles
  provider: yourator      # public JSON API v4, no auth
  api: https://www.yourator.co/api/v4/jobs
  market: TW
  enabled: true
```

Taiwan's mainstream boards (104 and others) land in Phase 1c under
`api/src/sourcing/providers/`.

## 2. (Physical device only) Expose the server

```bash
ngrok http 3000
```

Copy the generated `https://*.ngrok-free.app` URL into the iOS scheme's `NGROK_BASE_URL`
environment variable (DEBUG configuration only, per the plan's Migration Controls).

## 3. Run the iOS app

```bash
cd ios
open Swipe2Work.xcodeproj      # or .xcworkspace if SPM workspace is used
```

Run the `Swipe2Work` scheme on Simulator (uses `localhost` automatically) or a physical device
(uses the ngrok URL). Expected: app launches to an empty-profile state prompting CV upload.

## 4. Validate User Story 1 — CV upload

1. In-app, upload a sample **text-layer PDF** resume.
2. Expected: the app shows extracted keywords and a YoE estimate once parsing completes.
3. Edit one keyword and the YoE value; save.
4. Verify via API: `GET /v1/profile` reflects the edited values, not the raw extraction.
5. **Negative cases**: upload a scanned/photographed PDF → `422 no_text_layer`; upload an
   unsupported format (e.g. `.pages`) → `422 unsupported_format`. The message must say which, not a
   generic failure. A **DOCX must succeed** (rev 3 restored it).
6. **zh-Hant case**: upload a Traditional Chinese CV → keywords must be **non-empty** and YoE
   detected from forms like `5 年以上工作經驗`. An empty keyword set here is the silent-degradation
   defect (SDD R5), not an acceptable result.

## 5. Validate User Story 2 — swipe feed

1. Run a crawl: `npm run crawl` (Tier-1 sources from §1c), then confirm rows landed in
   `job_posting` with `market` set to `HK`/`TW`.
2. Open the feed tab; confirm cards are ranked, bilingual cards render correctly, and CJK titles
   do not clip at large Dynamic Type sizes.
3. Swipe one card left — confirm it disappears and does not reappear after a feed refresh.
4. Swipe one card right — confirm the app confirms **immediately** (`202`, status `queued`) without
   waiting on submission.
5. Verify via API: `GET /v1/jobs/feed` no longer returns either swiped job, and returns
   `exhausted: true` once the seeded set is consumed.
6. **Dedup check**: seed the same role from two providers with the same `employerApplyUrl` —
   confirm one card, not two.

## 6. Validate User Story 3 — prepare and apply

**Review-before-sending (default)**:
1. Swipe right on a job; confirm the app shows the **answer sheet** (each field, proposed answer,
   and where it came from) before anything is sent.
2. Edit one answer, tap confirm; verify `POST /v1/applications/{id}/confirm` returns `202` and the
   application reaches `applied` (allowlisted ATS) or `handed_off` (everything else).
3. For `handed_off`: confirm the app deep-links to the employer form, and that
   `POST /v1/applications/{id}/handoff-complete` moves it to `applied`.

**Auto-submit**:
1. In Settings, switch submission mode to auto-submit.
2. Swipe right on an **allowlisted** posting (Greenhouse/Lever/Ashby/Workable) with no unanswered
   questions → expect `applied` with no further user action.
3. Swipe right on a **non-allowlisted** posting → expect `awaiting_review`, *not* a submission
   attempt. This is the allowlist gate working (FR-009).
4. Swipe right on a posting whose form asks something outside the profile → expect
   `pending_needs_answer` plus a push notification; answer it, confirm submission resumes, and
   confirm a second posting with the same question does not prompt again (FR-021).
5. Swipe right on a posting asking a **sensitive** question (visa status / expected salary) →
   expect `pending_needs_answer` **even in auto-submit mode**, and confirm the answer is *not*
   reused on a later application (FR-022).
6. Exceed the daily cap → expect `409 cap_reached` and a clear in-app message (FR-024).

## 7. Validate User Story 4 — status tracking

1. Open the Tracking tab; confirm every right-swiped job appears with its current status.
2. Open one application's detail; confirm a status history/timeline is shown.
3. Mark an application `interview` from the detail view; confirm
   `POST /v1/applications/{id}/status` records it and the timeline gains an entry (FR-011a).
4. Attempt an illegal transition (e.g. `hired` on a `queued` application) → expect `409`.

## Test suites

```bash
# Server
cd api && npm test              # Jest unit + Supertest integration
cd api && npm run test:contract # validates responses against contracts/openapi.yaml

# iOS
cd ios && xcodebuild test -scheme Swipe2Work -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: all suites green before moving to `/speckit-tasks`.
