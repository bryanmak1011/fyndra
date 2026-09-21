# Fyndra API + Worker

TypeScript / Express / Prisma / PostgreSQL. See [../specs/001-job-swipe-apply/](../specs/001-job-swipe-apply/)
for the full design (SDD.md, contracts/openapi.yaml, data-model.md).

## Local development

Requires Node 22+ and a Postgres 16 instance.

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and LLM keys
npx prisma migrate dev
npm run dev             # API on http://localhost:3000
npm run worker          # separate process, in another terminal
```

Or via Docker (`docker compose up`) once you have Docker installed — not
available in the sandbox this scaffold was built in, so the Dockerfile and
docker-compose.yml are unverified locally; they follow standard patterns and
should work as-is.

## Testing

```bash
npm test           # Jest + Supertest, against a real Postgres database
npm run lint
npx tsc --noEmit
```

`tests/contract/auth.test.ts` exercises the auth flow end-to-end (request
code → verify → bearer-authenticated request) against a live Postgres
connection — no mocked database.

Every test file shares one database, so each one cleans up behind a **prefix
unique to that file** (`test-auth-`, `test-profile-`, `test-tracking-`, …)
and no test asserts on a global row count — Jest runs files in parallel, and
both rules exist because breaking either produced real intermittent failures.

### Test accounts that skip the one-time code

`AUTH_BYPASS_EMAILS` is a comma-separated list of addresses that sign in
without a code: `POST /auth/request-code` returns their session immediately,
in a `session` field, and the client goes straight to the feed.

This is an authentication bypass, so it is built to be unshippable rather
than merely switched off:

- it lives in the environment, never in source, so no address is baked into
  a build artifact;
- **the server refuses to boot** if it is set while `NODE_ENV=production`.
  Deliberately not "ignored in production" — a silent no-op leaves the
  variable sitting in a production environment looking harmless until
  somebody relaxes the check;
- it is empty unless explicitly set, so every environment defaults to no
  bypass;
- a bypass sign-in logs `auth_code_bypassed` at warn level;
- the 202 response shape is unchanged for everyone else (`{}`), so the
  endpoint still cannot be used to enumerate accounts.

`tests/unit/auth-bypass-config.test.ts` and `tests/contract/auth-bypass.test.ts`
hold all of that in place, including that near-miss addresses
(`xabc123@abcai.com`, `abc123@abcai.com.evil.test`) get nothing.

### Seeding a demo account

```bash
npm run seed:demo -- demo@fyndra.test                      # 10 HK/TW postings, ranked
npm run seed:demo -- demo@fyndra.test --login-code 424242  # …plus a known login code
```

Replaces (not appends to) anything tagged `sourceProvider: 'demo-seed'`, so
re-running is idempotent. This is what makes the iOS simulator walkthrough
possible without spending a paid Apify actor run per demo.

## What exists today

All four user stories are implemented and tested end-to-end against a real
Postgres database (and, where relevant, real external services — see below):

- `/v1/auth/*`, `/v1/devices` — email one-time-code auth, bearer tokens.
- `/v1/profile` — CV upload (PDF via `pdftotext`, DOCX via a hand-rolled ZIP
  reader), AES-256-GCM encryption at rest, LLM-based keyword/YoE extraction
  (bilingual English/Traditional-Chinese).
- `/v1/jobs` — the swipe feed, ranked by a deterministic (non-LLM) matcher
  using a bilingual skill taxonomy over CJK-bigram/Latin-word tokenization.
- `/v1/applications` — the apply flow: sensitive-question detection (pure
  regex, never LLM-gated, per SDD §10.1), LLM-drafted answer prefill with
  prompt-injection hardening, answer-fingerprint reuse, and status tracking.
- **Sourcing**: JobsDB Hong Kong and 104.com.tw — the two dominant HK/TW job
  boards, each sourced via a verified third-party Apify actor
  (`shahidirfan/jobsdb-scraper`, `youfuxu/taiwan-104-job-scraper`) rather
  than a direct fetch, since neither site has a workable direct-fetch path
  (see `../specs/001-job-swipe-apply/BLOCKERS.md`). Both actors were called
  live and their real output inspected before either provider
  (`src/sourcing/providers/jobsdb-hk.ts`, `tw104.ts`) was written. Yourator
  and the Greenhouse/Lever/Ashby/Workable ATS-tracked-company crawl that
  preceded this were removed entirely (2026-09-10) — these two market-wide
  boards cover far more HK/TW roles than a curated company list.
- **Apply route is handoff-only** — after live verification found no ATS
  platform exposes a public third-party submission API (even Greenhouse's
  requires a private employer-issued key), `determineApplyRoute()` in
  `src/sourcing/apply-route.ts` always returns `'handoff'`. The app prepares
  a prefilled answer sheet; the user submits on the employer's site. Now
  that ATS sourcing is gone, the only source with a known form-schema
  reader (`apply/schemas/greenhouse.ts`) never actually gets exercised in
  practice — left in place rather than deleted, since it's still correct
  and would apply again if an ATS source were reintroduced. See
  BLOCKERS.md's T067 entry for the fuller history.

Every `Application` response also carries `jobPostingId`, `jobTitle` and
`employer` (contract 0.4.0). The first was specified but never emitted; the
other two are an additive change made while building the tracking screen —
there is no `GET /jobs/{id}`, so without them the client could show a status
but not the job it belonged to.

The LLM client retries transient provider failures (HTTP 429/5xx, and the
HTTP-200-with-`ResourceExhausted`-payload shape OpenRouter's free tier
returns under load) with exponential backoff, and deliberately does not retry
a 4xx. This is production-correct — a user's CV parse should not fail because
the provider was briefly at capacity — and it also removed the recurring
free-tier flake that had been failing two integration tests per full run.

Not yet done: APNs push (T079, needs real Apple Developer credentials),
Firecrawl integration for JS-gated sources (T087).

## Architecture notes

- **Job queue is Postgres-backed** (`QueueJob` table + `SELECT ... FOR UPDATE
  SKIP LOCKED`), not Redis/BullMQ — see the `ponytail:` comment on the
  `QueueJob` model in `prisma/schema.prisma`. Fine for Phase 1 volume; the
  upgrade path is noted there if it's ever outgrown.
- **No dotenv dependency** — `server.ts`/`worker.ts` use Node's native
  `process.loadEnvFile()` (Node ≥20.6).
- **LLM access is via OpenRouter** (OpenAI-compatible), configured through
  `LLM_PROVIDER=openai-compatible` / `OPENAI_BASE_URL` / `LLM_MODEL` in
  `.env`. Free-tier reasoning models are slow and can hit shared-pool
  capacity limits (`"Worker local total request limit reached"`), returned
  as HTTP 200 with an error payload rather than a normal failure —
  `src/llm/client.ts` detects and surfaces this explicitly rather than
  crashing on `.choices[0]` of undefined. This shows up as an occasional
  flake in `tests/integration/cv-intake.test.ts`; it is a documented,
  accepted characteristic of the free tier, not a regression.
- **Sourcing is via Apify, not direct fetch** — `APIFY_API_TOKEN` in `.env`
  authenticates `src/sourcing/apify-client.ts`, a thin wrapper around
  Apify's `run-sync-get-dataset-items` REST endpoint. Each crawl runs a
  small seed list of role keywords (`JOBSDB_HK_QUERIES`, `TW104_QUERIES`,
  6 each) through the two actors — kept deliberately small since every
  actor run is a paid call (JobsDB actor: ~$0.99/1,000 results). Grow the
  keyword lists deliberately, not by default.
- **career-ops is a design reference only, never executed** — its scraping
  ethics (honour robots.txt/Crawl-delay, never defeat bot protection),
  provider reconnaissance, and status vocabulary informed this codebase, but
  none of its code runs here.
