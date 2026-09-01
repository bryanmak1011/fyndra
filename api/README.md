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
- **Sourcing**: a real crawler against Yourator and the Greenhouse, Lever,
  Ashby, and Workable ATS APIs, each verified live against real company
  accounts before any provider code was written (see
  `../specs/001-job-swipe-apply/BLOCKERS.md` for what was tried and ruled
  out, e.g. JobsDB HK, 104.com.tw).
- **Apply route is handoff-only** — after live verification found no ATS
  platform exposes a public third-party submission API (even Greenhouse's
  requires a private employer-issued key), `determineApplyRoute()` in
  `src/sourcing/apply-route.ts` always returns `'handoff'`. The app prepares
  a prefilled answer sheet; the user submits on the employer's site. See
  BLOCKERS.md's T067 entry for the options considered.

Not yet done: APNs push (T079, needs real Apple Developer credentials),
Firecrawl integration for JS-gated sources (T087), the 104.com.tw provider
(T088, blocked on a compliance GO decision).

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
- **career-ops is a design reference only, never executed** — its scraping
  ethics (honour robots.txt/Crawl-delay, never defeat bot protection),
  provider reconnaissance, and status vocabulary informed this codebase, but
  none of its code runs here.
