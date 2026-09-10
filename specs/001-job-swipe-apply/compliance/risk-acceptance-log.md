# Risk Acceptance Log

Records explicit, informed decisions to proceed against a Functional Analyst finding. Each entry
is a deliberate business call, not a default — see `source-assessment.md` for the underlying
research each entry overrides.

---

## 2026-08-31 — JobsDB Hong Kong (hk.jobsdb.com) and 104.com.tw sourcing

**Finding overridden**: `source-assessment.md` §1 and §3. JobsDB HK's ToS (§7(b)(iv)/§9(b)(i))
explicitly reserves automated access to a documented partner API; the public v5 search endpoint
this design uses is not that partner API. 104.com.tw returned HTTP 403 to every fetch attempt
(robots.txt, ToS, homepage) during the compliance review.

**Decision**: Product explicitly accepted the ToS risk and directed engineering to proceed with
scraping both sources, rather than pursuing a SEEK partner agreement (Appendix B8) or a human
legal read of 104.com.tw (Appendix B9) first.

**What this decision does and does not cover**:

- **Covers**: building a provider against JobsDB HK's public v5 search API despite its ToS
  reserving that access to partners. This is a **ToS/contract-law risk** — SEEK's remedy for a
  violation is contractual/civil (rate-limit, IP-block, cease-and-desist, or a claim under the
  ToS), not a technical barrier; the endpoint itself responds normally to a well-formed request.
- **Does NOT, by itself, cover**: defeating 104.com.tw's active bot detection (the HTTP 403 on
  every request). That is a **distinct and larger step** — accepting a ToS risk on a
  site that answers is not the same decision as building fingerprint evasion, IP rotation, or
  other measures to get past a system that is actively refusing the request. career-ops's own
  provider doctrine (adopted in SDD §6.3) draws exactly this line: *"never work around bot
  protection — a source that blocks us is dropped, not defeated."* Building a 104.com.tw
  provider requires first understanding *why* it 403s (missing headers? TLS fingerprint?
  Cloudflare challenge? geo-block?) and a **separate, explicit decision** on whether to work
  around whatever that turns out to be. Not yet made — see follow-up below.

**Consequence for engineering**:

- T046 (JobsDB HK provider) — **unblocked**, built same session as this log entry.
- T088 (104.com.tw provider) — **still blocked**, pending the narrower technical decision above.
  Next step is investigating what's producing the 403 before any circumvention question is even
  on the table.

**Consequence for risk register**: SDD.md R4 and R11 updated to "risk accepted, proceeding" rather
than "blocked" for JobsDB HK; R4 (104.com.tw) stays open pending the narrower question.

**Not affected by this entry**: cakeresume.com/cake.me (Art. 7.4 explicit prohibition, not
currently a task) and meet.jobs (service shut down, moot) — no decision was requested or made on
either.

---

## 2026-09-10 — Sourcing both JobsDB HK and 104.com.tw via third-party Apify actors

**Finding overridden**: the narrower question this log's 2026-08-31 entry left open for 104.com.tw
— *"why does it 403, and is defeating whatever that is a separate decision?"* — plus a change of
technical approach for JobsDB HK.

**Decision**: Product directed dropping the direct-fetch approach for both sources and sourcing
them instead via two third-party Apify actors: `shahidirfan/jobsdb-scraper` (JobsDB HK) and
`youfuxu/taiwan-104-job-scraper` (104.com.tw). Both were called live and their real output
inspected (see tasks.md T046/T088 build-status notes) before any provider code was written.

**What this decision does and does not cover, per source**:

- **JobsDB HK — no new risk.** The actor's own `list_url` field, observed on a real live call,
  shows it queries the identical public v5 search endpoint (`hk.jobsdb.com/api/jobsearch/v5/search
  ?siteKey=HK-Main`) this design always intended to use — it just already has the correct request
  shape figured out, which is what blocked T046 originally. This is the same ToS/contract-law risk
  already accepted 2026-08-31, delegated to a different implementer.
- **104.com.tw — a materially new decision, not covered by the 2026-08-31 entry.** That entry was
  explicit: accepting the ToS risk on JobsDB HK (a site that *answers* a well-formed request) is
  not the same decision as building or commissioning fingerprint evasion or browser automation
  against a site that's *actively refusing* the request (104.com.tw's HTTP 403). The chosen actor's
  own Docker build traceback (surfaced when a competing actor candidate failed) confirms this class
  of actor launches a real browser (Playwright/Patchright) to do the scrape — i.e. it is, on our
  behalf, doing exactly the kind of bot-detection workaround the 2026-08-31 entry drew a line
  around. Product's instruction here ("for 104, let's go with web scrape or again with Apify")
  is treated as the explicit, informed decision that carve-out called for — not inferred or
  assumed by engineering.

**Consequence for engineering**: T046 and T088 both unblocked and built 2026-09-10 (see
tasks.md). Yourator and the Greenhouse/Lever/Ashby/Workable ATS-tracked-company sourcing (T047,
T048) were separately removed per product direction, unrelated to compliance — see tasks.md's
build-status note for that decision.

**Consequence for risk register**: SDD.md R4 (104.com.tw) should move from "open, narrower
question pending" to "risk accepted, proceeding via third-party actor" — flagged here for whoever
next updates SDD.md's risk register, not yet applied to that document in this pass.
