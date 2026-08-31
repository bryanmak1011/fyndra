# T002 — App Store Review Guidelines Assessment: Automated Application Submission

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31
**Method**: Live fetch of `developer.apple.com/app-store/review/guidelines/`, cross-checked against
developer-forum discussion of real rejections on the relevant clauses. This document gates SDD §6.5
(apply subsystem), constitution Principle V, and tasks T067/T073.

**Note on scope**: SDD §11.3 already states Phase 1 produces no distributable build (no cloud
endpoint, so no TestFlight/App Store submission). This assessment is still required now, not later,
because it governs whether the auto-submit *feature itself* should be built at all — the SDD frames
this as constitution Principle V gating the submitter's construction, independent of when the binary
ships.

---

## 1. The core applicable clause: Guideline 5.2.2 (Third-Party Sites/Services)

> *"If your app uses, accesses, monetizes access to, or displays content from a third-party service,
> ensure that you are specifically permitted to do so under the service's terms of use. Authorization
> must be provided upon request."*
> — [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), §5.2.2

This is the single most consequential clause for this feature. It does not require a demo showing the
automation working — it requires the developer to be able to produce, on Apple's request,
**documentary proof of authorization** from each third-party service the app interacts with.

Cross-referencing this against T001's findings (`source-assessment.md`) is directly load-bearing
here: several of the sourcing/apply targets in the SDD's own design (cake.me's Art. 7.4, JobsDB's
§7(b)(iv)/§9(b)(i)) **explicitly prohibit** the kind of automated interaction this app performs. An
app that auto-submits to, or scrapes from, a service whose own terms forbid exactly that is not
"specifically permitted" under 5.2.2 — this is not a hypothetical rejection risk, it is a guideline
the app would be in documented violation of for any non-allowlisted, non-partnered source.

**Consequence for design**: SDD §6.5's allowlist-gating (auto-submit restricted to Greenhouse, Lever,
Ashby, Workable — sources with *documented, intended-for-third-party-use* public APIs, per T001) is
the correct mitigation *in principle*, because those four platforms built their APIs for exactly this
consumption pattern. But 5.2.2 does not distinguish "scrape" from "submit via documented API" — it
asks whether the *service's terms of use* permit the *app's specific use*. The ATS platforms'
job-board APIs are for **reading** postings; none of the four (Greenhouse, Lever, Ashby, Workable)
was reviewed in T001 for whether its ToS additionally permits a *third-party, non-employer-affiliated
app* to **submit applications on a candidate's behalf** through automation. This is a distinct
question from "is the job data public" and was out of scope for T001's read-side review. **Action
item, not yet closed**: before T067 (`submit-ats.ts`) is built, confirm each ATS's terms of use
covers automated *submission*, not just automated *reading*, or that each ATS's application-submission
flow is designed to accept programmatic candidate-initiated submissions (several ATS platforms
publish a `POST: Submit application` job-board endpoint specifically for candidate-facing career
sites — Greenhouse's documented API includes exactly this — which is a stronger footing than the read
side alone, but this still needs to be confirmed per-platform, not assumed from the read API's
existence).

---

## 2. Automated interaction with account/login on third-party services: Guideline 5.1.1(v)–(vi)

> *"If your core app functionality is not related to a specific social network..., you must provide
> access without a login or via another mechanism... An app may not store credentials or tokens to
> social networks off of the device and may only use such credentials or tokens to directly connect
> to the social network from the app itself while the app is in use."*
> *"Developers that use their apps to surreptitiously discover passwords or other private data will
> be removed from the Apple Developer Program."*
> — Guideline 5.1.1(v), 5.1.1(vi)

**This is directly favourable to the current design.** SDD §10.1 states as a deliberate boundary:
*"We do not store employer-site or platform passwords... Auto-submit targets public ATS endpoints
that accept an application without a candidate login."* Because the app never custodies third-party
credentials at all, 5.1.1(v)/(vi) — which is aimed at apps that log into other services on the user's
behalf — is largely defused by the "no credential custody" design choice already made in the SDD. This
is a genuine strength; keep it. Do not let a future ATS integration (e.g. one that requires the
candidate to have an existing account with that ATS) quietly reintroduce credential storage without
re-running this assessment.

---

## 3. Data collection, privacy nutrition label, and employment-related data: Guideline 5.1.1(i), 5.1.1(ii), 5.1.2(i)

> *"All apps must include a link to their privacy policy... The privacy policy must clearly and
> explicitly: Identify what data, if any, the app/service collects, how it collects that data, and
> all uses of that data... Explain its data retention/deletion policies and describe how a user can
> revoke consent and/or request deletion of the user's data."*
> — Guideline 5.1.1(i)

> *"Apps that collect user or usage data must secure user consent for the collection... Ensure your
> purpose strings clearly and completely describe your use of the data."*
> — Guideline 5.1.1(ii)

> *"You must clearly disclose where personal data will be shared with third parties, including with
> third-party AI, and obtain explicit permission before doing so."*
> — Guideline 5.1.2(i)

This app's data model is squarely in-scope for careful nutrition-label treatment: it collects a CV
(name, contact details, work history, and potentially a photo and government ID number depending on
what the user's CV format includes — HK/TW CVs commonly include a photo; see
`privacy-policy-requirements.md`), sends CV content and job-description text to an offshore LLM API
and to Firecrawl, and submits application answers — including free-text and drafted content — to
third-party ATS platforms. Concretely, before T067/T073 ship, the App Store Connect **Privacy Nutrition
Label** must declare, at minimum:
- **Contact Info** (name, email, phone) — linked to identity, used for App Functionality.
- **User Content** (CV documents, résumé text, application answers) — linked to identity, used for
  App Functionality; disclose that it is **shared with third parties** (the LLM provider and, for job
  descriptions only, Firecrawl) per 5.1.2(i)'s explicit-disclosure requirement.
- **Sensitive Info**, if the CV photo or any HKID/national-ID-number field is retained as structured
  data rather than opaque document bytes (see `sensitive-questions.md` and
  `privacy-policy-requirements.md` for why these fields must never be auto-used even if present).
- The in-app privacy policy (constitution V's `PrivacyInfo.xcprivacy`, T083) must name the LLM
  provider and Firecrawl as data recipients and state the CV retention period from
  `privacy-policy-requirements.md`.

---

## 4. Spam / low-quality automated behaviour: Guideline 4.3(a)-(b), and the "mass application" pattern

Apple's spam guidelines (4.3) are written primarily against duplicate-app and templated-app patterns,
not against in-app automation volume — no clause was found that directly addresses "an app that
submits many automated actions to third parties." However, this is exactly the shape of risk SDD R10
(employer-side harm) and R1 (App Store rejection) already flag, and it interacts with 5.2.2: an app
that is caught mass-submitting to a third-party service whose terms cap or prohibit that volume is
back to a 5.2.2 authorization problem, just discovered through a volume complaint rather than a
proactive review. **The volume caps in `volume-policy.md` (T005) are therefore not just a product
courtesy — they are a control that keeps the app inside the "specifically permitted" boundary of
5.2.2 over time**, and should be described that way in any Apple review notes.

---

## 5. What Apple review notes / disclosure this app needs at submission (for Phase 2, when it applies)

Given 5.2.2's "authorization must be provided upon request," the review-notes field in App Store
Connect should proactively include, not wait to be asked for:
1. A one-paragraph description of the allowlist gating (which ATS platforms, and why — their
   documented job-board APIs, per T001).
2. Confirmation that no third-party credentials are stored (defuses 5.1.1(v)/(vi) before it's raised).
3. A link to (or copy of) the ATS platforms' API documentation showing the submission endpoint is
   intended for exactly this candidate-submission use.
4. The volume caps from `volume-policy.md`, framed as an anti-abuse control.
5. The privacy policy link with CV retention and third-party (LLM/Firecrawl) data-sharing disclosure
   already live.

---

## 6. Risk rating

**Overall: Medium**, conditional on two things the current design already does and one thing it has
not yet closed:

- **Lowers the risk** (already in the design): no credential custody (§10.1); allowlist restricted to
  platforms with documented, third-party-facing APIs rather than arbitrary scraping (§6.5); volume
  caps planned (§6.5.3, gated by T005); LinkedIn/Indeed excluded entirely (D3) — removing the two
  highest-profile automation-hostile platforms from the picture entirely.
- **Raises the risk** (open item from this review): 5.2.2 requires the *submission* side of each
  allowlisted ATS's terms to permit third-party candidate-submission automation, not merely that the
  *read* side is a documented public API — this has not been separately confirmed per ATS platform
  and should be closed before T067, alongside re-confirming this for the two NEEDS-LEGAL-REVIEW /
  NO-GO sourcing verdicts in `source-assessment.md` (cake.me explicitly forbids automated tools
  extracting or interacting with the platform at all, which would also block any future auto-submit
  path there — consistent with the SDD's decision not to include Cake in the ATS allowlist).
- **Raises the risk** if the nutrition-label and in-app disclosure work (§3 above) is treated as
  boilerplate rather than accurately reflecting that CV content leaves Apple's device and reaches two
  offshore third parties (LLM provider, Firecrawl) plus, on submission, the target employer/ATS.

**Would push this to High**: building the submitter against any source marked NO-GO or
NEEDS-LEGAL-REVIEW in `source-assessment.md` without resolving that review first, or shipping without
the nutrition-label/privacy-policy disclosures in §3.

**Would justify Low**: closing the per-ATS submission-terms confirmation in §1 and treating the
volume caps as an enforced, non-bypassable server-side control (already the SDD's stated intent in
§6.5.3) rather than a client-side suggestion.

Sources:
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
