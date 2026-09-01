# Open Blockers & Decisions Needed

Running log of things that came up during autonomous implementation that need your input.
Newest first. Each entry: what's blocked, why, what I did instead (if anything), and the
question for you.

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
