# T001 — Per-Source ToS / robots.txt Assessment

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31
**Method**: Live fetch of `https://<host>/robots.txt` and each site's published Terms of Service /
Terms of Use, quoting the operative clause. Where a fetch failed, that is recorded explicitly rather
than inferred. This document gates SDD §6.3 (sourcing subsystem) and tasks T046–T048, T088.

**Verdict key**: **GO** = no obstruction found in the material we could access. **NO-GO** = an
explicit prohibition (or an unreachable, actively-blocking site) makes the source unsafe to scrape.
**NEEDS-LEGAL-REVIEW** = mixed or incomplete signal; do not build against this source until a human
has read the full ToS and, where relevant, obtained written permission.

---

## 1. hk.jobsdb.com (SEEK, Hong Kong) — Tier 1

**robots.txt** (`https://hk.jobsdb.com/robots.txt`, fetched 2026-08-31): for the general `User-agent: *`
group, the file **disallows job listing pages, the GraphQL endpoint, and the API job-search
functions**, with only narrow parameter-based exceptions. It also fully disallows `LinkedInBot`,
`Baiduspider`, and `PetalBot`, while carving out specific allowances for `LinkedInBot` on job content
and for `facebookexternalhit` on job URLs. Known AI crawlers (`GPTBot`, `CCBot`, `anthropic-ai`, etc.)
are allowed broadly but explicitly **restricted from company pages and job postings**.

**Terms** (`https://hk.jobsdb.com/terms`, fetched 2026-08-31) — quoted clauses:
- §7(b)(iv): *"You may not use data mining, robots, screen scraping, or similar automated data
  gathering, extraction or publication tools."*
- §9(b)(i): *"you must not use, or assist anyone to use, any automated process, script, tool, bot,
  scraper or other technical means to: access, query, search, copy, collect, mine or harvest
  information"*
- §8(u): *"scrape, harvest or export Profiles ... or contact details, or engage in any data broking,
  except via a documented API and in compliance with its terms"*
- §9(d): *"We may use reasonable technical measures (including rate-limiting, traffic shaping and
  device fingerprinting) to detect and prevent automated access and scraping. Circumventing these
  measures is prohibited."*
- §20(b): governing law is Victoria, Australia.

**Documented API**: SEEK operates a partner/employer API programme (`hk.employer.seek.com/partners`)
under its own Partner Terms of Use — this is the "documented API" §8(u) carves out, and it is a
commercial partnership channel, not an open self-serve endpoint.

**Correction to SDD D4**: the SDD's design premise — that the public v5 search JSON endpoint the
JobsDB web client itself calls (`siteKey=HK-Main`) is fair game because it is "already public" — is
**directly contradicted** by both signals above: robots.txt disallows exactly that class of endpoint
for general crawlers, and the ToS expressly prohibits automated scraping/data-mining except through
the documented partner API. career-ops's own use of this endpoint does not change what SEEK's terms
say about it; a design reference having found the endpoint is not the same as SEEK licensing its use.

**Verdict: NO-GO** for the scrape-the-public-endpoint approach as designed. **Path forward**: apply
to SEEK's partner API programme (commercial/contractual relationship, likely with a review or
revenue-share condition — Product decision, not Functional Analyst). Until a partner agreement
exists, JobsDB HK must be treated as unavailable as a source, which invalidates the "Tier 1 is cheap"
premise in SDD §6.3 and reopens SDD R6 (feed-dry risk) for Hong Kong specifically.

---

## 2. yourator.co (Taiwan, startup/digital roles) — Tier 1

**robots.txt** (`https://www.yourator.co/robots.txt`, fetched 2026-08-31):
```
User-agent: *
Disallow: /r/*
```
Sitemap is published (`https://assets.yourator.co/sitemap.xml.gz`). Only `/r/*` (referral-tracking
links) is disallowed; job listing and API paths are not blocked.

**Terms**: fetched `https://www.yourator.co/privacy`, which is the page indexed for Yourator's
privacy/user/enterprise terms. **No clause prohibiting automated access, scraping, crawling, or bot
traffic was found** in the accessible text. The only data-use restriction found is aimed at
*employer* users re-using candidate résumé data: *"嚴禁為其他目的或另以任何方式將前述履歷資料提供或授權予其他第三人利用"*
("strictly prohibited to use [résumé] data for other purposes or provide/authorize third parties to
use it") — this governs what an employer does with a candidate's résumé, not what a third party may
do with public job listings.

**Caveat**: I could not confirm this is the complete Terms of Service document (Yourator's footer
links to a combined privacy/terms page rather than a clearly separate ToS); a short manual read by a
human before the provider ships is still warranted, but nothing found blocks the approach.

**API**: `yourator.co/api/v4/jobs`, unauthenticated, no cookie required (matches SDD D4's description).

**Verdict: GO**, with a light-touch caveat (confirm no separate ToS document exists that we missed).
Honour robots.txt's `/r/*` exclusion and D5's provider doctrine (Crawl-delay if published, back off on
429).

---

## 3. 104.com.tw (Taiwan's dominant board) — Tier 2, highest priority per SDD §6.3

**robots.txt**: `https://www.104.com.tw/robots.txt` and `https://104.com.tw/robots.txt` **both
returned HTTP 403 Forbidden** to the fetch tool, on repeated attempts.

**Terms**: `https://www.104.com.tw/info/terms` also **returned HTTP 403 Forbidden**. The bare
homepage (`https://www.104.com.tw`) **also returned HTTP 403 Forbidden**. Every attempted fetch to
this domain was blocked at the edge — this is not a page-not-found or a redirect, it is a uniform
403 across robots.txt, the homepage, and the terms page.

**What this means**: I could not read 104.com.tw's actual robots.txt or ToS text, so I cannot quote
a clause either way. But the blocking behaviour is itself evidence relevant to SDD R4 ("104.com.tw
anti-bot/ToS," already rated High severity): a site that returns 403 to an ordinary, non-adversarial
HTTP fetch of its own robots.txt is running active bot detection at the edge (WAF/Cloudflare-class
protection, matching the anti-bot posture that made R4 a named risk in the first place). Community
sources (Python/Taiwan scraping tutorials and forum posts found via search) corroborate that 104.com.tw
is a commonly-scraped-but-actively-defended target, with several tutorials carrying explicit
"educational use only, not for commercial use" disclaimers — informal evidence, not a legal
determination, but consistent with an actively hostile posture toward third-party automated access.

**Documented API**: `developers.104.com.tw` exists and is real, but its published products (履歷 API
service, 人資系統 API) are aimed at **employers integrating their own recruiting/HR systems with 104**
(inbound résumé delivery, headcount/org-data sync) — not an open, unauthenticated job-search API for
a third-party consumer app to pull postings from. It does not appear to substitute for scraping.

**Verdict: NEEDS-LEGAL-REVIEW, leaning NO-GO** for a scraping-based provider as currently scoped.
Per SDD D5's own adopted doctrine — *"never work around bot protection... a source that starts
fighting us is dropped, not defeated"* — a site that blocks even a passive robots.txt read is
signalling non-consent before any scraping logic is even written. **Do not start T088
(`tw104.ts`) until**: (a) a human reads 104.com.tw's ToS directly in an authenticated browser session
(this tool could not), and (b) 104's partner/employer API program is checked for a legitimate
job-search-consumer track. Given SDD's own framing — *"104.com.tw is the single highest-value
provider to get right"* — this NEEDS-LEGAL-REVIEW is the single most consequential finding in this
document for Taiwan sourcing breadth (see also SDD R6, feed-dry risk).

---

## 4. 1111.com.tw — Tier 2

**robots.txt** (`https://www.1111.com.tw/robots.txt`, fetched 2026-08-31): a large rule set (~80+
disallowed paths) blocking member-area paths (`/zone/`, `/talents/`, `/login/`, various `##SP/`
directories), with explicit `Allow` rules for job listings, corporate pages, and static assets.
Sitemap published at `https://www.1111.com.tw/sitemap/sitemap.xml`.

**Terms**: fetched the member service terms (`https://recruit.1111.com.tw/dMembership.aspx`). **No
clause explicitly prohibiting automated access, crawling, scraping, or bots was found** in the
accessible content. The nearest relevant clause restricts what a job-poster may do with résumé data
received (*"刊登人不得將求職者履歷資料轉作徵才以外的用途"* — a poster must not repurpose a job seeker's résumé
data beyond recruitment) — again a restriction on employers, not on reading public listings.

**Caveat**: this is a long, multi-section legal document; the fetch tool summarizes rather than
returning the full text verbatim, so an explicit anti-scraping clause elsewhere in the document
cannot be ruled out with confidence.

**Verdict: NEEDS-LEGAL-REVIEW** — robots.txt is permissive for job-listing paths and no blocking
clause surfaced, but the summarization risk above means this should get a full manual read (not
re-fetch) before a provider is built, rather than a clean GO.

---

## 5. cakeresume.com / cake.me ("Cake") — Tier 2

**robots.txt**: `cakeresume.com/robots.txt` returns a 301 redirect to `cake.me/robots.txt`
(cakeresume.com has been consolidated into the cake.me domain/brand). `cake.me/robots.txt`:
```
User-agent: *
Sitemap: https://www.cake.me/sitemap.xml
```
No `Disallow` at all — permissive by robots.txt alone.

**Terms** (`https://www.cake.me/terms-of-service`, fetched 2026-08-31) — quoted clauses:
- Art. 7.4: *"Without the Platform's written consent, you may not use any automated tools or
  processes (including but not limited to crawlers, bots, scrapers, batch downloaders, plugins, or
  high-volume API requests) to extract or monitor data from the Platform."*
- Art. 7.5: *"Without the Platform's written consent, you may not use any data from the Platform
  (including any portion, derivative data, query results, aggregated outputs, or vectorized
  representations) to train, fine-tune, validate, test, or enhance any machine learning, statistical,
  or language models..."*
- Art. 7.6: Cake reserves the right to rate-limit and cap query volume, page views, downloads, and
  API usage.

**Verdict: NO-GO** without a written agreement. Article 7.4 is an unambiguous, explicit prohibition
on exactly the crawling behaviour this project needs, overriding the permissive robots.txt (robots.txt
governs crawler *behaviour expectations*, the ToS is the actual contract). Per SDD D5's doctrine, Cake
should be dropped as an automated source unless/until Cake grants written consent (a partnership
conversation, not an engineering workaround). Art. 7.5 is a secondary flag: even incidental use of
scraped Cake job-description text as LLM context should avoid anything that could be read as
"training, fine-tuning, or enhancing" a model on Cake's data — ephemeral per-request use for matching
is a different act than model training, but this distinction should be made explicit in any future
partner conversation, not assumed.

---

## 6. meet.jobs — Tier 2

**Status finding (supersedes ToS/robots review)**: meet.jobs's own site states: *"Meet.jobs officially
ceased website operations on June 30, 2026."* Referral-reward processing continues through
2026-12-31, and user profile/application data is stated to be retained per applicable privacy law,
but the service is **closed to new postings and new candidate activity**.

**robots.txt** (`https://meet.jobs/robots.txt`, fetched 2026-08-31): returns HTTP 404 (no robots.txt
file exists) — consistent with a site in wind-down.

**Verdict: NO-GO — moot.** Not a ToS or legal-risk finding; there is nothing live to source from.
Recommend removing meet.jobs from the Tier 2 provider list entirely rather than carrying it as a
future task, and re-check at implementation time in case this is a partial/temporary sunset.

---

## 7. ctgoodjobs.hk — Tier 2 (HK second tier)

**robots.txt** (`https://www.ctgoodjobs.hk/robots.txt`, fetched 2026-08-31): explicitly issues
`Disallow: /` blanket bans against several **named job-aggregator bots** — `JoobleBot`, `trovitBot`,
`YisouSpider`, and others. For unnamed/general user agents it allows `/llms.txt`, `/ads.txt`, job
listing pages, and company image directories, but disallows HR-management, résumé-builder, and
article sections; ends with a default `Allow: /`.

**Terms** (`https://www.ctgoodjobs.hk/terms-conditions`, fetched 2026-08-31) — quoted clauses:
- §1.1.4: *"The user shall not use any tool, software or programme or act otherwise to disturb the
  normal operation of the server of the Web Site."*
- §9.3 (under an "AI Services" heading): *"You agree not to engage in malicious activities such as
  prompt injection, reverse engineering, deployment of automated scraping tools, or mass extraction
  against our services."*

**Verdict: NEEDS-LEGAL-REVIEW, leaning NO-GO.** Two independent signals point the same way even
though neither is a clean absolute ban for a generic user agent: (1) the robots.txt file's explicit,
by-name blocklist of other job aggregators shows ctgoodjobs.hk actively polices exactly this category
of consumer, and a scraper built for this project is functionally the same category of bot; (2) §9.3
prohibits "automated scraping tools" and "mass extraction," and although it sits under an "AI
Services" heading, its plain language ("against our services," not "against our AI features") reads
broader than that heading suggests — worth a full manual read of §9 to confirm scope before relying on
the narrow reading. Recommend treating as NO-GO unless a human reviewer confirms §9.3 is scoped only
to a specific AI feature, not the site generally.

---

## 8. cpjobs.com (SCMP, HK second tier) — Tier 2

**robots.txt** (`https://www.cpjobs.com/robots.txt`, fetched 2026-08-31):
```
User-agent: *
Allow: /
Disallow: /*/me/
Disallow: /*/myjob/
Disallow: /*/login
Disallow: /*/register
Disallow: /*/forgot-password
Disallow: /*/reset-password
Disallow: /*/activate
Disallow: /*/talent/request/
Crawl-delay: 10
Sitemap: https://www.cpjobs.com/sitemap.xml
```
Permissive for job-listing paths; only account/auth flows are blocked; explicit `Crawl-delay: 10`
must be honoured per SDD's own provider doctrine.

**Terms**: the correct URL is `https://www.cpjobs.com/hk/terms-conditions` (confirmed via search
indexing), but **direct fetch of that URL returned HTTP 404** on every attempt from this tool,
despite being a real, indexed, live page. I could not independently verify its text. A search-result
snippet (not a verified primary-source quote — treat with appropriate caution) described: *"No
copying, modification, or commercial exploitation of site contents is permitted without express
permission from CPJobs."* This is close enough to a standard scraping-adjacent restriction that it
should not be treated as a clean pass.

**Verdict: NEEDS-LEGAL-REVIEW.** robots.txt is favourable and gives a concrete `Crawl-delay: 10` to
honour, but the Terms of Use text could not be directly verified by this tool and the one indirect
signal found leans restrictive. A human should open `https://www.cpjobs.com/hk/terms-conditions` in
a browser and confirm before this source is built.

---

## 9. ATS platforms: Greenhouse, Lever, Ashby, Workable

These are not scraping targets — each publishes a documented, unauthenticated **Job Board API**
intended for exactly this use (candidate-facing career-site/job-aggregation consumption), which is a
categorically different legal position from scraping a job board's own search results.

| Platform | robots.txt (job-board host) | Documented public API |
|---|---|---|
| **Greenhouse** | `boards.greenhouse.io/robots.txt`: `Disallow: /embed/` only, otherwise open | `GET https://boards-api.greenhouse.io/v1/boards/{company}/jobs` — unauthenticated, JSON, documented at `developers.greenhouse.io`. Official [API overview](https://support.greenhouse.io/hc/en-us/articles/10568627186203-Greenhouse-API-overview) describes it as built "so web developers can build custom career and application sites." No published hard rate limit, but Greenhouse's own guidance is to poll on a schedule, not per-page-view. |
| **Lever** | `jobs.lever.co/robots.txt`: publishes IETF Content-Signal directives — `Content-Signal: search=yes,ai-train=no,use=reference` for `User-agent: *`, and explicit `Disallow: /` for a list of AI/model-training crawlers (`GPTBot`, `CCBot`, `ClaudeBot`, `Google-Extended`, etc.); ends with a general `Allow: / / Crawl-delay: 1`. | `GET https://api.lever.co/v0/postings/{client}?mode=json` — public, documented at [github.com/lever/postings-api](https://github.com/lever/postings-api), designed for exactly this consumption pattern. Note: the `ai-train=no` content signal is about training models on Lever's page content, not about reading job postings for matching — but do not use Lever posting text to fine-tune any model. |
| **Ashby** | `jobs.ashbyhq.com/robots.txt`: `Disallow: /meeting/`, `/b/`, `/api/` (booking/internal paths); the public API is a separate documented host, not this one. | `GET https://api.ashbyhq.com/posting-api/job-board/{org}` — official, documented at `developers.ashbyhq.com`, explicitly built for "partner job feeds." |
| **Workable** | `apply.workable.com/robots.txt`: `Content-Signal: search=yes, ai-input=yes, ai-train=no` for `User-agent: *`, `Disallow:` (empty — nothing blocked). | `GET https://apply.workable.com/api/v1/widget/accounts/{account}` — documented at `developer.workable.com`; read-only, per-account, no filtering/search support server-side. |

**Verdict: GO for all four**, using each platform's documented Job Board API — never the rendered
HTML pages — and filtering results to HK/TW locations client-side after fetch (none of the four
APIs support server-side geo filtering). Respect the `ai-train=no` / `Content-Signal` directives:
job-posting text may be used transiently for matching and prefill, never for model training or
fine-tuning.

---

## Summary table

| Source | robots.txt | ToS | Documented API | Verdict |
|---|---|---|---|---|
| hk.jobsdb.com | Disallows job listings/API for general crawlers | Explicit anti-scraping (§7b-iv, §9b-i) | Partner-only (SEEK employer/partner program) | **NO-GO** (as scraped); pursue partnership |
| yourator.co | Permissive except `/r/*` | No prohibition found (caveat: doc completeness unconfirmed) | Public, unauthenticated `v4/jobs` | **GO** |
| 104.com.tw | **Inaccessible — 403 on every fetch** | **Inaccessible — 403 on every fetch** | Employer/HR-integration only, not open | **NEEDS-LEGAL-REVIEW, leaning NO-GO** |
| 1111.com.tw | Permissive for listings | No prohibition found (caveat: doc completeness unconfirmed) | None found | **NEEDS-LEGAL-REVIEW** |
| cakeresume.com / cake.me | Fully permissive | **Explicit prohibition (Art. 7.4)** | None public | **NO-GO** without written consent |
| meet.jobs | No robots.txt (404) | N/A | N/A | **NO-GO — service ceased operations 2026-06-30** |
| ctgoodjobs.hk | Explicitly blocks named job-aggregator bots | Anti-scraping language (§9.3), scope ambiguous | None found | **NEEDS-LEGAL-REVIEW, leaning NO-GO** |
| cpjobs.com | Permissive, `Crawl-delay: 10` | **Not independently verified** (404 on fetch); indirect signal restrictive | None found | **NEEDS-LEGAL-REVIEW** |
| Greenhouse / Lever / Ashby / Workable | Open, or open with content-signal opt-outs | N/A — official APIs govern | **Yes, all four, documented** | **GO** |

**Net effect on SDD §6.3's Tier 1/Tier 2 ladder**: only Yourator and the four ATS families clear a
clean GO from source material actually reachable by this review. JobsDB HK (assumed Tier-1-cheap) is
NO-GO as designed and needs a partnership track instead. 104.com.tw (assumed the single
highest-value Tier 2 build) could not even be read and is NEEDS-LEGAL-REVIEW leaning NO-GO. This
materially changes the "Tier 1 is cheap" framing in SDD §6.3 and should feed directly into the R4
severity update and Appendix B1 resolution in T007.
