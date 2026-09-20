# Phase 0 Research: Swipe-to-Apply Job Search (HK/TW)

**Revised 2026-08-31 (rev 3)** — rev 1 recorded assumptions about career-ops written before reading
it; rev 2 grounded them in its source. **Rev 3 records the decision to use career-ops as a design
reference only**: we build every runtime component, and career-ops contributes knowledge (proven
public endpoints, provider doctrine, status vocabulary, the sensitive-field carve-out). Every claim
below still cites a file, because the reconnaissance is exactly what we are reusing.

---

## career-ops: reference, not runtime

- **Decision (rev 3)**: career-ops is **read, cited, and never executed**. We build the scrapers,
  the submitter, the CV parser, and the tracker. PostgreSQL is the only store.
- **Rationale**: rev 2's per-user-workspace adapter was a large amount of machinery — subprocess
  spawning, `CAREER_OPS_ROOT` scoping, whole-file-lock job serialisation, two storage models to
  reconcile — bought to reuse code that only partly fit. Since we were writing our own scrapers and
  our own submitter anyway, the adapter's remaining value was reconnaissance, and reconnaissance
  costs nothing to reuse. Removing it deletes an entire failure domain.
- **What that buys back**: plain Node 22 LTS instead of a ≥22.5 floor inherited from career-ops's
  `node:sqlite` tracker; DOCX support, since the format restriction was `intake.mjs`'s and not ours;
  ordinary queue scaling instead of per-user serialisation.
- **Historical note (rev 2 findings, still the evidence base)**: career-ops has no HTTP API for its
  core (123 root `.mjs` scripts, `package.json` has no `bin`), no notion of a user or tenant, and
  `path-resolver.mjs` reads `CAREER_OPS_ROOT` from `process.env` at module scope. `ARCHITECTURE.md`:
  *"Files are canonical — databases are derived… SQLite will never become a primary store."* Those
  facts are why integrating it was expensive, and why referencing it is cheap.
- **Alternatives considered**: (a) the rev-2 subprocess adapter — rejected above. (b) Fork its
  `web/` Next.js app (34 API routes) as our backend — rejected: no auth by design, and its own
  `origin-guard.mjs` states that a route answering an unauthenticated request *"is therefore a
  remote-code-execution primitive"*. Its apply routes remain a useful **design** reference for
  field extraction and answer prompting.

## Who submits the application

- **Decision**: **We build the submitter and the prefill.** career-ops informs neither's code, only
  its safety rules.
- **Rationale**: career-ops refuses to submit, in code and in licence. `web/src/lib/apply/session.ts`
  `fillSession`: *"NEVER clicks a submit/apply control — only fills/selects/checks/attaches"*;
  `handoffSession`: *"Hand the real (now pre-filled) form to the HUMAN to review + submit… We never
  submit."* `prepare-application.mjs`: *"Never POSTs anything."* `LEGAL_DISCLAIMER.md` §5 lists
  *"auto-submitting applications without human review"* under unacceptable use, and `CONTRIBUTING.md`
  says such contributions are actively rejected. There is no version of this feature that gets
  auto-submit from career-ops.
- **Scope chosen** (confirmed with the user): auto-submit is **allowlist-gated** to applicant
  tracking systems with published form schemas (Greenhouse, Lever, Ashby, Workable). Never
  LinkedIn/Indeed, never an unrecognised form. Everything else falls back to review-and-handoff.
- **Alternatives considered**: full auto-submit everywhere — rejected for App Store review risk and
  user account-ban risk; dropping auto-submit entirely — rejected because it removes the product's
  core promise. The allowlist keeps the promise while bounding the risk.
- **Also inherited deliberately**: their sensitive-field carve-out
  (`web/src/lib/apply/answer-prompt.mjs`) *"keeps legal, visa, work-authorization, salary and
  demographic questions from being auto-filled"*. We adopt it as a hard rule and extend it with
  HKID / 身分證字號.

## Job sourcing for Hong Kong and Taiwan

- **Decision**: We write every provider, ordered easiest-proven-first.
  1. **JobsDB Hong Kong** — HK's dominant board. career-ops's `providers/jobstreet.mjs` documents
     `HK-Main → hk.jobsdb.com` on SEEK's public v5 search API. We implement a thin JSON provider
     against that same endpoint.
  2. **Yourator (Taiwan startups)** — `providers/yourator.mjs` documents the public
     `api/v4/jobs` (no auth, no cookie), and notes ~36% of rows carry the employer's own ATS URL,
     which is our dedup key. Again a thin JSON provider.
  3. **ATS families** (Greenhouse, Lever, Ashby, Workable, Workday…) — public per-tenant board
     APIs, covering multinational roles located in HK/TW.
  4. **Taiwan mainstream**: chiefly **104.com.tw**, then 1111, Cake, Meet.jobs. Genuine new
     research. HK second tier (CTgoodjobs, cpjobs) only if the above proves thin.
- **Rationale**: The premise that career-ops's providers miss both markets is **false for Hong
  Kong** — it documents the dominant HK board's endpoint — and **true for mainstream Taiwan**
  (`glints.mjs` covers only SG/ID/MY/VN; SEEK has no Taiwan site). Since we build the code either
  way, the reference's value is knowing which endpoints are public and stable before writing a line.
  That is the expensive half of scraping.
- **Alternatives considered**: Indeed via career-ops's `plugins/apify/` — rejected (paid per run,
  human-in-the-loop by design, third-party scraping dependency, and Indeed prohibits automated
  access anyway).

## Crawling method for new sources

- **Decision**: A preference ladder — (1) the public JSON endpoint the site's own web client calls
  → thin deterministic Node provider, zero-token, no browser; (2) JS-gated pages only → **Firecrawl**;
  (3) Crawl4AI reconsidered only if volume/cost demands self-hosting.
- **Rationale**: Plain-HTTP JSON is how JobsDB and Yourator work, and how career-ops's ~83
  providers work — cheap, fast, and no browser to operate. Firecrawl over Crawl4AI for Phase 1 because Crawl4AI is
  Python: adopting it means a second runtime, a second container, and owning proxy and anti-bot
  operations in what is otherwise a Node/TS stack. Firecrawl is a call from the service we already
  have.
- **Constraint**: Firecrawl sees public job pages only — **never** CV or profile PII.
- **Non-negotiable source rules**, adopted from career-ops's own posture: honour `robots.txt`,
  `Crawl-delay`, and `429 Retry-After`; **never work around bot protection**. Their
  `docs/SUPPORTED_JOB_BOARDS.md` retires a provider precisely because *"career-ops does not work
  around bot protection, so this is not a provider to repair"* — a source that blocks us gets
  dropped, not defeated.

## Where the intelligence comes from

- **Decision**: Call an LLM **directly via SDK** for semantic work, adapting career-ops's `modes/`
  prompt text as prompt structure. Do **not** spawn agent CLIs in a request path.
- **Rationale**: career-ops's semantic half is prompt-and-subprocess shaped, designed for a laptop
  with an agent CLI installed (`AGENTS.md` lists `claude -p`, `codex exec`, `opencode run`…), and
  its own web app budgets `maxDuration = 800` seconds for such a call. That is not a server
  request-path dependency worth inheriting. Its `.env.example` already contemplates direct keys
  (`GEMINI_API_KEY`, `OPENAI_API_KEY` + `OPENAI_BASE_URL`), so direct SDK use is the supported path.
- **What genuinely needs a model**: CV keyword/YoE semantic mapping (`intake.mjs` extracts text but
  *"NEVER writes cv.md / config/profile.yml"* — mapping is the LLM's job), form-answer drafting,
  cross-language relevance. Its 1-5 job score is a prompt (`modes/_shared.md`, `modes/oferta.md`),
  and `rank-pipeline.mjs` *"ANNOTATES … never filters, reorders, or deletes"* — so there is no
  deterministic scorer to inherit.
- **Consequence**: feed-scale ranking must be deterministic (career-ops's zero-token adjuncts
  `jd-skill-gap.mjs`, `skill-extract.mjs`, `title-keywords.mjs`, `role-matcher.mjs` are reusable);
  LLM evaluation runs only on user intent.

## Structured answer drafting: the Choice/Score/Noul contract (decided 2026-09-21, sharpened for Architecture Board)

- **Status**: Decided 2026-09-21, ahead of Architecture Board review. Not yet implemented —
  `apply/prefill.ts` still runs entirely on the generic OpenAI-compatible `LlmClient` described
  above.
- **Background**: the proposal that went into this review (2026-09-20) was to draft choice-type
  prefill fields via Typesafe AI's **Jev**, a "System One" model exposing typed decision primitives
  — `Choice` (pick one of N options), `Score` (rubric score), `Noul` (boolean truth value) — each
  returned with a probability/confidence, rather than free text to parse. Verified against
  TypeSafe's own material (2026-09-21): Jev is real (launched 2026-09-19) but is **hosted-only,
  behind an early-access waitlist, with no published weights and no on-prem/self-host option** —
  see sources below. That rules out self-hosting Jev itself.
- **Decision**: do **not** integrate TypeSafe's hosted Jev API. Instead, **reimplement the same
  `state` + `Choice`/`Score`/`Noul` request contract in TypeScript, against Fyndra's existing,
  already-privacy-reviewed OpenAI-compatible `LlmClient` provider** — the same pattern TypeSafe's
  own official `system-one-adapter-python` (MIT-licensed) uses: native structured outputs or a
  prompted-JSON fallback with corrective retries, no TypeSafe account or data transfer involved.
  This was previously considered and rejected in this document as "a hand-rolled version
  reproduces the problem without vendor-side reliability/latency tuning" — TypeSafe's own
  reference implementation undercuts that rejection, since it's the identical pattern, now
  vendor-validated rather than invented from scratch. The adapter itself is Python; Fyndra ports
  the pattern, not the library.
- **Rationale** (unchanged from the original proposal): `draftAnswer()` today prompts the LLM to
  "answer with EXACTLY one of these labels" for choice-type fields and string-matches the raw text
  response, treating the literal string `"UNKNOWN"` as the no-answer signal (`prefill.ts`). A typed
  `Choice` result — `{choice, probabilities, confidence}` — removes that fragile exact-label-match
  step and replaces the binary "got text or didn't" pending-question decision with a real
  confidence score to threshold on.
- **Scope**: choice-type fields only, in `apply/prefill.ts`'s `draftAnswer()`. Free-text fields (no
  fixed `values`) stay on the existing `LlmClient` completion path — no typed primitive covers
  open-ended generation. CV interpretation, feed ranking, and per-job evaluation are explicitly
  **out of scope** for this contract; any future use of `Score`/`Noul` there is its own decision,
  not an implicit extension of this one. Sensitive-question classification is unaffected either
  way — that gate is pure regex (`apply/sensitive.ts`) and never reaches an LLM call, before or
  after this change.
- **Fallback behavior**: if the structured-output call errors or times out, the field fails closed
  to `pending_needs_answer` — no silent fallback to the free-text `draftAnswer()` path for that
  field. Consistent with this project's fail-closed posture elsewhere (JobsDB HK, ATS submission).
- **Confidence threshold**: **70%, explicitly provisional** — a starting default for the pilot, not
  a calibrated number. There is no existing confidence-threshold precedent anywhere in this
  codebase to anchor to (CV interpretation has none either). Revisit once real pilot confidence/
  outcome data exists.
- **Client interface shape**: a new, separate `ChoiceClient` interface, injected only into
  `prefill.ts` — not bolted onto `LlmClient` (`llm/client.ts`), which is also used by
  `handoff.ts` and `cv/interpret.ts` for plain text completion and has no reason to carry a typed
  choice-decision capability those callers don't use.
- **Data-handling review**: not required beyond what already covers `LlmClient` today
  (`compliance/privacy-policy-requirements.md` §5) — since no new vendor and no new data
  destination is introduced, this sidesteps the offshore-processor review the original Jev
  proposal would have needed.
- **Cost/latency bar**: qualitative reasoning ("purpose-built structured-output path, same
  provider already in use") is sufficient to ship this as a pilot; real numbers become an exit
  condition before considering anything beyond the current scope.
- **Considered and set aside**: TypeSafe's actual hosted Jev API — technically the more
  "authentic" version of the typed-decision idea, but requires (1) a second offshore-processor
  review under §5, (2) joining TypeSafe's early-access waitlist, an acceptance timeline outside
  Fyndra's control, working against a fast go-to-market posture. Apple's iOS 27 Foundation Models
  framework (`@Generable` guided generation, on-device and Private Cloud Compute) — functionally
  covers the same typed-decision need, with an even stronger privacy story (on-device: no network
  call at all), but requires the client (not the API/worker) to own this logic, conflicting with
  §6's "iOS client — presentation only" invariant, and effectively gates the feature behind iOS 27
  against this project's iOS 17+ target, days after iOS 27's launch. **Noted as a real future
  direction, not part of this decision** — revisit once iOS 27 adoption is meaningful and the
  client/server logic-boundary question gets its own explicit decision.
- **Sources**: [TypeSafe AI's Jev: What "System One Models" Actually Are](https://www.truefoundry.com/blog/typesafe-ai-jev);
  [TypeSafe AI Releases Jev — MarkTechPost](https://www.marktechpost.com/2026/09/19/typesafe-ai-releases-jev/);
  [system-one-adapter-python discussion](https://github.com/FindMalek/guesswork/issues/1);
  [Apple Foundation Models / Private Cloud Compute, iOS 27](https://developer.apple.com/private-cloud-compute/).

## Traditional Chinese support

- **Decision**: CJK segmentation before any keyword operation, plus a curated **bilingual skill
  taxonomy** for cross-language matching at feed scale. Multilingual embeddings deferred to Phase 2.
- **Rationale**: Chinese has no whitespace word boundaries, and career-ops's extractors are
  whitespace/English-oriented — they will **silently under-extract** on zh-Hant, returning
  plausible-looking near-empty results instead of failing. That is the dangerous failure mode: it
  ships. A taxonomy (專案管理 ↔ project management) is deterministic, cheap at feed scale, and
  auditable.
- **Alternatives considered**: LLM extraction on every posting — correct but too slow and expensive
  for a feed; relying on `jd-similarity.mjs` — cannot bridge languages at all.

## Server test stack

- **Decision**: Jest + Supertest, with Prisma's test-database pattern against Dockerized Postgres.
- **Rationale**: De facto standard for Express/TypeScript; Supertest drives the app in-process, so
  tests stay fast and CI-friendly, matching the constitution's CI-blocking rule.
- **Alternatives considered**: Vitest (less mature Supertest tooling, and a second test-runner
  mental model alongside XCTest for no benefit at this scale); Mocha+Chai (more setup, no gain).
- **Added in rev 2**: fixtures must include Traditional Chinese CVs and JDs with **asserted
  non-empty** extraction, so the silent-degradation failure mode above fails a test.

## iOS networking client generation

- **Decision**: Hand-authored `URLSession` client against the OpenAPI doc for Phase 1.
- **Rationale**: ~15 endpoints, still evolving with the UI; codegen adds a build step and generated-code
  churn before the contract stabilises. Contract tests keep the two honest.
- **Alternatives considered**: `swift-openapi-generator` — a strong candidate once the contract
  settles post-Phase 1; deferred, not rejected.

## Local device connectivity

- **Decision**: ngrok tunnel to the `api` container for DEBUG builds on a physical device;
  Simulator uses `localhost`.
- **Rationale**: Matches the specified Migration Controls and is the standard workaround for a
  device being unable to reach a developer machine's `localhost`.
- **Alternatives considered**: LAN IP addressing — brittle across networks (VPNs, client isolation).
- **Consequence to state**: RELEASE has no endpoint in Phase 1, so **no TestFlight or App Store
  build is possible** until cloud deployment lands.

---

**Output**: All NEEDS CLARIFICATION items resolved. Remaining open decisions are product/legal, not
technical, and are tracked in [SDD Appendix B](./SDD.md#appendix-b-open-decisions).
