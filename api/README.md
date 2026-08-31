# Swipe2Work API + Worker

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

## Architecture notes

- **Job queue is Postgres-backed** (`QueueJob` table + `SELECT ... FOR UPDATE
  SKIP LOCKED`), not Redis/BullMQ — see the `ponytail:` comment on the
  `QueueJob` model in `prisma/schema.prisma`. Fine for Phase 1 volume; the
  upgrade path is noted there if it's ever outgrown.
- **No dotenv dependency** — `server.ts`/`worker.ts` use Node's native
  `process.loadEnvFile()` (Node ≥20.6).
- Route handlers for CV upload, the swipe feed, and applications are **not
  yet implemented** — they land in the User Story phases (see
  `../specs/001-job-swipe-apply/tasks.md`, T025 onward). Only `/v1/auth/*`
  and `/v1/devices` exist today.
