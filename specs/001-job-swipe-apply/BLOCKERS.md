# Open Blockers & Decisions Needed

Running log of things that came up during autonomous implementation that need your input.
Newest first. Each entry: what's blocked, why, what I did instead (if anything), and the
question for you.

---

## 2026-09-10 — RESOLVED: sourcing pivot to Apify closes out three entries below

Per your direction ("drop other job sources... for JobsDB go with Apify (shahidirfan/Jobsdb-Scraper)
... for 104 go with web scrap or again with Apify"), sourcing now runs entirely on two Apify
actors — see `sourcing/providers/jobsdb-hk.ts` and `tw104.ts`, both live-verified before writing
any code. This resolves the **JobsDB Hong Kong** entry below (T046 is done) and the **104.com.tw**
half of the picture (T088 is done). Yourator and the Greenhouse/Lever/Ashby/Workable ATS sourcing
were removed entirely, which also makes the **Lever/Ashby/Workable** entry below moot (there's no
longer any ATS sourcing to narrow) and softens the **T067 auto-submit** entry (its core finding —
no ATS platform has a public submission API — still stands, but nothing sources ATS postings
anymore, so it's no longer blocking anything in practice). Full details in
`compliance/risk-acceptance-log.md`'s 2026-09-10 entry and `tasks.md`'s T046/T047/T048/T088
build-status notes. Original entries below left as-written for the historical record.

---

## 2026-09-01 — Firecrawl integration (T087) parked — needs an API key

**Status**: Not started, not a code blocker — just needs a credential I don't have.

T087 adds Firecrawl for JS-gated sources that plain fetch can't read. Same pattern as the
OpenRouter key: I can implement and test this as soon as you supply a Firecrawl API key (and
confirm which specific sources need it — everything sourced so far, Yourator plus the four ATS
APIs, works fine over plain fetch, so this is genuinely optional until a JS-gated source is
identified as worth adding). Parking rather than guessing at a key or skipping the "no CV/profile
PII is ever sent to Firecrawl" assertion the task explicitly calls for.

**Question for you**: do you have a Firecrawl key, and if so, is there a specific HK/TW source
in mind that needs it, or should this stay parked until one comes up?

---

## 2026-09-01 — 🛑 CRITICAL: no ATS platform supports true third-party auto-submission (T067)

**Status**: Stopped. Not worked around. This is bigger than the Lever/Ashby/Workable finding
below — it also rules out Greenhouse, the one platform that finding left standing.

Before writing the submitter (T067), I checked Greenhouse's own documented application-submission
endpoint (`POST boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}`) directly against their
official docs. It requires **HTTP Basic Auth with an API key from the employer's own Greenhouse
"API Credentials" page** — quoting Greenhouse's docs directly: *"the Basic Auth username is your
API key... No password is required."* This is a **private, per-organization credential**, not the
public board token that's already visible in every job URL. We have no way to obtain it for any
employer we don't have a direct integration relationship with.

**What this means, combined with the T064 finding below**: there is no ATS platform — Greenhouse,
Lever, Ashby, or Workable — whose genuinely public, credential-free surface includes a submission
API a third-party candidate-facing app can call. The only way to submit a real application to any
of them without an employer-issued API key is to **drive the actual candidate-facing web form** —
i.e. real browser automation clicking through and submitting a form. That is a fundamentally
different (and materially riskier) technical approach than an API POST, and it is **exactly what
career-ops's own design refuses to do** (`web/src/lib/apply/session.ts`: *"NEVER clicks a
submit/apply control"*) and what this project's own SDD.md D2/§6.5 assumed we'd avoid by using
clean API calls instead of form automation.

**What I did**: stopped, rather than try to reverse-engineer the actual candidate-facing form's
real POST target — that would be undocumented-endpoint-guessing on a *live submission* action
(unlike a read-only scrape, a wrong guess here could partially submit a broken application on a
real user's behalf), which is a materially worse failure mode than anything else this session has
guessed at. I did **not** touch `sourcing/apply-route.ts` further after this finding — see below
for what it currently does and why that's now provisional pending your decision.

**What this changes about the whole apply flow, if it stands**: `direct_submit_allowlisted` has no
real backing for *any* current provider. Every application would route to `handoff` (prepare an
answer sheet, hand it to the user to submit themselves) — which is still a fully functional, valuable
product; it just means "auto-submit" as a mode doesn't yet have anything to auto-submit *to*.

**Question for you** — this needs a real decision, not an engineering workaround:
1. **Accept handoff-only for Phase 1c.** Auto-submit mode becomes forward-looking infrastructure
   (already built: caps, sensitive-question gating, answer prefill) with nothing to attach it to
   yet. Ship review/handoff as the real product now.
2. **Pursue employer-side API credentials.** Greenhouse (and the others) do support real
   integrations for parties who register as an actual job board / ATS partner — this is a business
   relationship (and likely a review/approval process per platform), not something I can set up.
3. **Explicitly decide to build browser-automation submission anyway**, accepting the ToS/App
   Store/account-ban risk this design has avoided since rev 1 — if you want this path, I'd want it
   as a deliberate, informed choice (like the JobsDB HK risk acceptance), not something I infer.

I did not touch T068 (handoff) or T069 (state machine) pending your read on this — building them
is valuable either way (handoff is now the *primary* path under option 1, and still needed as the
fallback under options 2/3), so I'm continuing there while this sits open.

---

## 2026-09-01 — Lever, Ashby, Workable can't be auto-submit targets — only Greenhouse can (T064)

**Status**: Not blocked — resolved by narrowing scope, but flagging because it changes a decision
you made (the auto-submit allowlist) and reduces effective auto-submit coverage materially.

Before writing the ATS form-schema readers (T064), I checked whether each of the four ATS platforms
actually exposes application form fields (what fields exist, which are required, what type) through
a public, unauthenticated API — the same check I skipped for JobsDB HK last session, applied
deliberately this time so it doesn't happen twice.

**Result**: only **Greenhouse** does.
`boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}?questions=true` is public and returns real,
structured form fields — confirmed live against a GitLab posting (13 real questions, including one
that's a textbook Category-2 sensitive question: *"Will you now or in the future require
sponsorship..."*). The other three gate this behind credentials we don't have:
- **Lever**: its own GitHub docs (`github.com/lever/postings-api`) state the public Postings API
  does "not expose custom questions built into your job postings," and its apply endpoint requires
  an issued API key (`?key=...`).
- **Ashby**: form schema (`applicationFormDefinition`) lives behind `api.ashbyhq.com/jobPosting.info`,
  which needs basic auth + a `jobsRead` permission grant — confirmed with a live 401.
- **Workable**: its form-fields endpoint (`/jobs/{shortcode}/application_form`) 404s without valid
  account credentials — it's part of Workable's authenticated employer-side API, not the public
  candidate-facing widget T048 already reads from.

**What I changed**: `sourcing/apply-route.ts`'s allowlist now contains only Greenhouse hosts. Lever,
Ashby, and Workable postings still source correctly (T048's read-side sourcing is unaffected — that
API surface is genuinely public) but now route to `handoff` instead of
`direct_submit_allowlisted`, since we can't safely fill a form we can't read the schema of.
`tests/unit/apply-route.test.ts` updated to match.

**Why I didn't try to work around it**: same reasoning as JobsDB HK — guessing at authenticated
endpoints or trying to reverse-engineer form fields from rendered HTML would be the kind of
adversarial probing I've been avoiding all session, not a legitimate public-API integration.

**Question for you**: this shrinks real auto-submit coverage to Greenhouse-hosted roles only for
Phase 1c. Options, if you want more coverage: (a) accept Greenhouse-only for now, expand later if
partner API access to Lever/Ashby/Workable becomes available; (b) pursue a partner/API-key
relationship with one or more of them (a business conversation, not an engineering task); (c) live
with Greenhouse-only as the permanent design — plenty of companies use it, and `handoff` still lets
users apply to everything else, just with one more manual step.

---

## 2026-09-01 — JobsDB Hong Kong provider (T046) — still stuck

**Status**: Blocked, not worked around.

You accepted the ToS risk for scraping JobsDB HK (`compliance/risk-acceptance-log.md`). When I
tried to actually build it, a plain POST to SEEK's v5 search endpoint returned `Cannot POST`
(wrong request shape — method/path/params don't match what I assumed from the design reference).
My next instinct — retry with a browser-style header — got blocked by Claude Code's own safety
classifier before I could see the response, which is the tool layer independently treating that
specific move as suspicious.

**I stopped rather than try another way around it.** This needs one of:
- A browser DevTools network trace of hk.jobsdb.com's actual search request (method, path, exact
  headers/params) that I can then implement faithfully, or
- Official SEEK API documentation if a partner/public API doc exists, or
- Your explicit sign-off to keep probing with different request shapes (I'd rather not guess my
  way toward something that looks like fingerprint evasion).

**Question for you**: can you grab a network trace, or should I keep this parked and move on to
104.com.tw / other sourcing work instead?

---

*(Future entries go above this line, newest first.)*
