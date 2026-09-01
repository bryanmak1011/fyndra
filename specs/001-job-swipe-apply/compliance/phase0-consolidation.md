# T007 — Phase 0 Compliance Consolidation

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31

> **Addendum, 2026-09-01**: the "Product naming" row below (and `naming-attribution.md`, which it
> cites) refers to **"Swipe2Work"**, the product's name on 2026-08-31. It has since been renamed
> to **Fyndra** — see `naming-attribution.md`'s own addendum and SDD.md rev 3.2. This document is
> otherwise preserved as originally written.

This is the Phase 0 compliance gate deliverable required by `tasks.md` T007: it consolidates T001–T006
into one GO/NO-GO table per capability, and states what engineering is blocked vs. unblocked. Full
reasoning and quoted sources are in the individual documents in this directory: `source-assessment.md`,
`app-store-assessment.md`, `privacy-policy-requirements.md`, `naming-attribution.md`,
`volume-policy.md`, `sensitive-questions.md`.

---

## Capability verdict table

| Capability | Verdict | Basis | Task doc |
|---|---|---|---|
| **HK sourcing — hk.jobsdb.com** | **NO-GO** (as designed) | ToS §7(b)(iv)/§9(b)(i) explicitly prohibit scraping/data-mining "except via a documented API"; robots.txt disallows job-listing/API paths for general crawlers. SEEK's public v5 endpoint is not the "documented API" the ToS carves out — that's the separate partner program. | `source-assessment.md` §1 |
| **HK sourcing — ctgoodjobs.hk** | **NEEDS-LEGAL-REVIEW**, leaning NO-GO | robots.txt names and blocks other job-aggregator bots by name; ToS §9.3 prohibits "automated scraping tools, or mass extraction" (scope of the "AI Services" heading unconfirmed). | `source-assessment.md` §7 |
| **HK sourcing — cpjobs.com** | **NEEDS-LEGAL-REVIEW** | robots.txt permissive with `Crawl-delay: 10`; ToS page could not be independently fetched (404 on direct fetch despite being indexed) — one indirect signal suggests a content-reuse restriction. | `source-assessment.md` §8 |
| **TW sourcing — yourator.co** | **GO** | robots.txt permissive except `/r/*`; no anti-scraping clause found in accessible terms; public unauthenticated `v4/jobs` API matches SDD's description. | `source-assessment.md` §2 |
| **TW sourcing — 104.com.tw** | **NEEDS-LEGAL-REVIEW**, leaning NO-GO | robots.txt, homepage, and terms page **all returned HTTP 403** to every fetch attempt — could not read either document; the blocking itself corroborates SDD's own R4 (anti-bot risk) for the single highest-priority Tier-2 source. | `source-assessment.md` §3 |
| **TW sourcing — 1111.com.tw** | **NEEDS-LEGAL-REVIEW** | robots.txt permissive for listings; no anti-scraping clause found, but document completeness could not be confirmed (long multi-section ToS, tool summarizes rather than returning full text). | `source-assessment.md` §4 |
| **TW sourcing — cakeresume.com / cake.me** | **NO-GO** without written consent | ToS Art. 7.4 explicitly prohibits "crawlers, bots, scrapers, batch downloaders, plugins, or high-volume API requests" without written consent — unambiguous, overrides the permissive robots.txt. | `source-assessment.md` §5 |
| **TW sourcing — meet.jobs** | **NO-GO — moot** | Service itself confirms it "officially ceased website operations on June 30, 2026." Nothing live to source. | `source-assessment.md` §6 |
| **ATS sourcing — Greenhouse / Lever / Ashby / Workable** | **GO** | All four publish documented, unauthenticated Job Board APIs purpose-built for third-party consumption. Read side is clear; submission side needs a separate per-platform ToS confirmation before T067 (see App Store row below). | `source-assessment.md` §9 |
| **Auto-submit feature (App Store)** | **Medium risk — conditionally GO** | Guideline 5.2.2 requires proof of authorization on request. Allowlist-to-documented-API design is the right mitigation, but "documented API" was only confirmed for reading postings, not for third-party automated *submission* — that must be confirmed per ATS platform before T067. No credential custody already defuses 5.1.1(v)/(vi). | `app-store-assessment.md` |
| **CV/PII retention & cross-border transfer** | **GO, with concrete defaults** | No numeric retention period is legally mandated; recommended default: account deletion + 30 days. Firecrawl gets zero PII exposure (already SDD's design). LLM provider is an unavoidable cross-border transfer for CV interpretation and answer drafting — permissible today under both PDPO (§33 not in force) and PDPA (Art. 21 default-permits), but must be disclosed, minimized (strip ID-number patterns before sending), and never include sensitive-carve-out categories. | `privacy-policy-requirements.md` |
| **Product naming — "Swipe2Work"** | **NEEDS-REVIEW — was incorrectly marked resolved** | Clear of career-ops's mark (no collision). **Not clear of an active, conceptually identical third-party product, `swipe2work.ai` (Germany)** — same swipe-to-apply-with-AI concept, nearly identical name. SDD Appendix B4 should be reopened; a real trademark clearance search is needed, this WebSearch is not a substitute. | `naming-attribution.md` §2 |
| **Volume policy (auto-submit caps)** | **GO — defaults set** | 15/day per-user cap; 1 concurrent per-employer cap; `handed_off` applications excluded from both (user-performed submission, not app-performed). | `volume-policy.md` |
| **Sensitive-question carve-out** | **GO — taxonomy delivered** | Five categories (work authorization, visa sponsorship, HKID/National ID, expected salary, demographics) specified bilingually with fail-closed matching guidance, ready for T063/T058. | `sensitive-questions.md` |

---

## What engineering is blocked vs. unblocked

**Unblocked — proceed as designed:**
- T047 (Yourator provider) — clear GO.
- T048 (ATS-family providers: Greenhouse, Lever, Ashby, Workable) for the **read side** — clear GO;
  confirm submission-side ToS per platform before T067 specifically (not a blocker for T048 itself,
  which only reads postings).
- T030 (CV storage) — retention policy is now defined (account deletion + 30 days); T030 can proceed
  using the retention-clock design in `privacy-policy-requirements.md` §4/§7.
- T054, T060 (volume caps) — FR-024 defaults are now set (`volume-policy.md` §4); proceed.
- T063, T058 (sensitive-field carve-out) — taxonomy delivered (`sensitive-questions.md`); proceed.
- T083 (privacy disclosure / `PrivacyInfo.xcprivacy`) — required disclosures are specified
  (`privacy-policy-requirements.md` §7, `app-store-assessment.md` §3); proceed.

**Still blocked — do not start:**
- **T046 (JobsDB HK provider)** — blocked. The scraping approach in the SDD is NO-GO; needs either a
  SEEK partner-API agreement (Product/business decision) or the source dropped for Hong Kong, which
  would reopen SDD R6 (feed-dry risk) for the HK market specifically.
- **T088 (104.com.tw provider)** — blocked. Could not even read the ToS; needs a human to read it in
  a browser and confirm before this, the highest-value Tier-2 source, is built. This is the most
  consequential open item for Taiwan sourcing breadth.
- Any provider for **cakeresume.com/cake.me** — blocked absent written consent from Cake (Art. 7.4 is
  explicit); not currently a task in tasks.md but flagged in case it's added later.
- Any provider for **ctgoodjobs.hk** or **cpjobs.com** — not yet explicit tasks in tasks.md, but flag
  now: both are NEEDS-LEGAL-REVIEW and should not be started without a follow-up human legal read.
- Remove **meet.jobs** from the Tier 2 roadmap — the source no longer operates.
- **T067 (ATS submitter)** — partially blocked: allowlist-gated design is sound, but do not ship until
  the per-ATS submission-terms question in `app-store-assessment.md` §1 is closed.
- **Any App Store Connect submission** — not applicable yet per SDD §11.3 (no cloud endpoint in Phase
  1), but when it becomes applicable, do not submit without the nutrition-label and review-notes
  content in `app-store-assessment.md` §3/§5 in place.
- **Any external use of the name "Swipe2Work"** (App Store Connect record, domain registration,
  marketing) beyond internal repo/spec use — blocked pending a real trademark clearance search
  triggered by the `swipe2work.ai` finding. This is a new blocker not previously flagged in SDD
  Appendix B4.

---

## Recommended edits to SDD §12 (Risk Register) and Appendix B

- **R1** (App Store rejection): keep **High**, but note the mitigation is now conditional on closing
  the per-ATS submission-authorization gap (`app-store-assessment.md` §1), not yet fully closed.
- **R3** (Trademark): raise from **Low to Medium** — career-ops's mark is clear, but the newly-found
  `swipe2work.ai` collision is an open, unresolved naming risk that did not exist in the SDD's
  original R3 framing.
- **R4** (104.com.tw anti-bot/ToS): keep **High**, and add: this review could not access the site's
  robots.txt or ToS at all (uniform 403), which corroborates rather than resolves the risk.
- **R6** (Feed runs dry): the "Tier 1 breadth first" mitigation is weaker than assumed — JobsDB HK,
  previously treated as cheap/proven, is NO-GO as designed. Consider raising R6 from Med, or adding an
  explicit dependency note to R6 pointing at the JobsDB HK finding.
- **R10** (Employer-side harm): mitigation is now concrete — `volume-policy.md`'s specific caps (not
  just "caps" as a placeholder).
- **Appendix B1**: not simply satisfied — resolve to "8 of 12 sources reviewed; 2 GO outright (Yourator,
  4x ATS-read), 1 NO-GO outright (JobsDB HK, Cake), 1 moot (meet.jobs), 3 NEEDS-LEGAL-REVIEW
  (104.com.tw, ctgoodjobs.hk, cpjobs.com, 1111.com.tw)."
- **Appendix B4**: change from "resolved: Swipe2Work" back to **open**, pointing at
  `naming-attribution.md` §2.
- **Appendix B5**: resolved — 30 days post-account-deletion, per `privacy-policy-requirements.md` §4.
- **Appendix B6**: resolved — `handed_off` excluded from both caps, per `volume-policy.md` §3.

---

## Overall Phase 0 exit assessment

**Not a clean pass.** Sourcing and auto-submit are **partially unblocked**: the ATS-API path and
Yourator are clear to build now; CV retention, volume caps, and the sensitive-field taxonomy are fully
resolved and unblock their dependent tasks outright. But two premises load-bearing to the SDD's own
"Tier 1 is cheap" framing — JobsDB HK and 104.com.tw — did not survive this review intact, and a
previously-closed decision (product naming) has reopened. These should go back to Product/Tech Lead
before Phase 1a/1c proceed on the affected tasks, per the blocked-task list above.
