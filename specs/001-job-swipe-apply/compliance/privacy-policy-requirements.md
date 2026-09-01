# T003 — CV/PII Handling Policy under HK PDPO and TW PDPA

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31
**Method**: Live fetch of the Hong Kong PCPD's summary of the six Data Protection Principles and the
Laws & Regulations Database (Ministry of Justice) English text of Taiwan's Personal Data Protection
Act, plus current research on the cross-border transfer status of each law. This is a startup-scale
compliance briefing, not a full legal memo — a qualified HK/TW privacy lawyer should still review
before Phase 2 distribution. This document gates SDD §10.1 and task T030 (CV storage).

---

## 1. What data is in scope

A CV uploaded to this app is personal data under both statutes, and for HK/TW CVs specifically it
routinely contains more than a résumé's English/US equivalent would:
- Name, contact details, work history, education — ordinary personal data under both laws.
- **A photograph** — very commonly included on HK and TW CVs (unlike US/UK norms). Not statutorily
  "sensitive personal data" under TW PDPA Article 6 (which lists medical records, healthcare,
  genetics, sex life, physical examination, and criminal records specifically), but it is still
  personal data requiring the same purpose-limitation and consent treatment, and it is more uniquely
  identifying than most CV fields.
- **HKID number / 身分證字號 (Taiwan National ID)** — sometimes present on HK/TW CVs, especially
  government/regulated-sector applications. This is a national identifier and, per
  `sensitive-questions.md`, must never be auto-extracted into a reusable structured field or
  auto-populated into any application form.
- Demographic fields sometimes present on HK/TW CVs by local convention (age/DOB, marital status)
  even without being solicited by our app — the CV parser will encounter them incidentally.

---

## 2. Lawful basis for processing

**Hong Kong PDPO** does not use a GDPR-style enumerated "lawful basis" list; instead **Data
Protection Principle 1 (DPP1)** requires collection to be *"for a lawful purpose directly related to
a function or activity of the data user,"* collected by *"lawful and fair"* means, and *"necessary and
adequate but not excessive."* ([PCPD summary](https://www.pcpd.org.hk/english/data_privacy_law/ordinance_at_a_Glance/ordinance.html),
fetched 2026-08-31.) The user uploading their own CV to receive job matches and submit applications
is a textbook case of directly-related, user-initiated purpose — lawful basis is satisfied by the act
of upload plus the disclosure of what that upload is for (DPP1 also requires informing the data
subject of the purpose at collection time).

**Taiwan PDPA Article 5** requires that collection and use *"shall not exceed the necessary scope of
specific purposes, and shall have legitimate and reasonable connections with the purposes of
collection."* ([Laws & Regulations Database, Ministry of Justice](https://law.moj.gov.tw/Eng/LawClass/LawAll.aspx?PCode=I0050021),
fetched 2026-08-31.) Same conclusion: user-initiated CV upload for the stated purpose (job matching
and application) is within scope, provided the app does not later use the CV for an unrelated purpose
(e.g. selling résumé data, or using it to train a general-purpose model — see §5).

**Concrete requirement**: the app's account-creation / CV-upload flow must state the purpose in plain
language before upload (not buried only in a linked privacy policy) — e.g. *"Your CV will be used to
find and prepare job applications for roles you swipe on, and to draft answers to application
questions. It will not be used for any other purpose without asking you first."* This satisfies both
DPP1's collection-notice requirement and PDPA Article 5's purpose-connection requirement.

---

## 3. Purpose limitation

**HK DPP3 (Use Limitation)**: personal data *"cannot be used for any new purpose which is not or is
unrelated to the original purpose"* without the data subject's *"express and voluntary consent."*
**TW PDPA Article 16** (for the private-sector equivalent, Article 20) similarly restricts use to the
specific purpose of collection.

**Concrete implication for this design**: CV content and application-answer content may be used for
(a) matching against job postings, (b) drafting application answers, (c) enabling the user's own
review/edit of those answers. It may **not** be used for (d) building an aggregate skills/demographics
dataset for analytics or product decisions without separate, explicit consent, and may **not** be sent
to the LLM provider or Firecrawl for any purpose beyond the single request that needs it (e.g. never
bundled into a provider's model-improvement/training pipeline — see the LLM provider's data-use
terms before selecting one, and prefer a provider/plan that contractually excludes API input from
training, which most enterprise-tier LLM APIs already offer as a toggle).

---

## 4. Retention period — recommended default

Neither PDPO nor PDPA specifies a numeric retention period; both require only that data not be *"kept
longer than is necessary"* (HK DPP2) or be erased *"when the specific purpose of data collection no
longer exists, or upon expiration of the relevant time period"* (TW PDPA Article 11(3)). This leaves
the number to be set as policy, defensibly.

**Recommendation: CV files, parsed CV text, and application-answer history are retained until account
deletion + 30 days, then irreversibly erased.**

Rationale for 30 days specifically (not immediate, not longer):
- **Not immediate**, because SDD §7 item 5 already designs CV storage as a separate store with "one
  operation" delete — a short grace window absorbs accidental deletion requests, App Store account-
  deletion-flow retries, and lets in-flight applications (queued or `awaiting_review`) resolve or fail
  cleanly rather than being yanked mid-flight, which would otherwise leave an `Application` row
  pointing at deleted source data.
- **Not longer**, because a longer window has no purpose-limitation justification once the account
  itself is gone — there is no ongoing "function or activity" (DPP1's own language) to justify holding
  the data past the user's own decision to leave. 30 days is short enough to not read as indefinite
  retention-by-default, and precedented as a common "soft delete" grace window.
- **While the account is active but unused**: recommend a secondary rule — CVs older than 12 months
  with no login activity trigger a retention-reminder notification before any deletion, rather than
  silent auto-deletion, since an inactive account is not the same as a deletion request and auto-
  deleting a live user's only stored CV without warning would itself be a poor-faith practice, not a
  legal requirement either way.
- **Sensitive answers are stricter already**: SDD §7 item 4 already states answers to sensitive
  questions (visa, HKID, salary, demographics) are *never reused across applications* — this document
  reinforces that these fields should also **not be retained in structured/reusable form at all**
  beyond the single application they were entered for; they may remain inside the immutable
  `ApplicationStatusEvent`/history record for audit purposes but must not populate any answer-reuse
  cache (`api/src/apply/answer-reuse.ts`, T066 explicitly excludes sensitive questions from reuse —
  this document confirms that exclusion is a privacy requirement, not only a safety one).

**Action for T030**: implement CV storage with a retention-clock column (`deletedAt` /
`purgeScheduledAt`) set to `accountDeletedAt + 30 days`, and a scheduled job that hard-deletes past
that timestamp — this satisfies the "one-operation delete" design in SDD §7 while giving the 30-day
grace window above.

---

## 5. Cross-border transfer — the LLM provider and Firecrawl are both offshore processors

**Hong Kong**: PDPO **Section 33** (the statutory restriction on transferring personal data outside
Hong Kong unless the destination has adequate protection or a listed condition is met) **is not
currently in force** — it was enacted in 1996 but has never been activated, and as of this review
there is no announced commencement date (2026 PDPO reform consultations reportedly include it as a
potential future agenda item, but nothing enacted). This means there is **currently no statutory bar**
on sending HK users' CV data to an offshore LLM API or to Firecrawl. However, the PCPD has issued
non-binding **Guidance on Recommended Model Contractual Clauses for Cross-border Transfer of Personal
Data** (May 2022) as a best-practice benchmark, and Section 33 could be activated during this
product's life — building as if it already applies is the safer default. ([Baker McKenzie summary](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/asia-pacific/hong-kong/topics/international-data-transfer),
[Hogan Lovells on PCPD Model Contractual Clauses](https://www.hoganlovells.com/en/publications/hong-kong-pcpd-publishes-model-contractual-clauses-for-cross-border-data-transfers).)

**Taiwan**: PDPA **Article 21** permits international transfer by default, but empowers the competent
authority (now centralized under the PDPC following the November 2025 amendments) to *restrict*
transfers by a non-government agency where, among other conditions, *"the country receiving the
personal data lacks proper regulations on protection of personal data and the data subjects' rights
and interests may consequently be harmed."* No blanket restriction currently targets US-based LLM
providers specifically, but the standard is a discretionary, authority-issued restriction rather than
a fixed adequacy list — meaning the compliance posture can change without much notice.
([PDPC — Article 21 text and interpretation](https://www.pdpc.gov.tw/en/News_Content/165/790/).)

**Concrete requirements given both are currently permissive but neither is a safe-harbour**:
1. **CV files and full parsed CV text are never sent to Firecrawl.** SDD §6.3 already states this as
   a hard constraint ("no CV or profile PII is ever sent to Firecrawl — it sees public job pages
   only") — this review confirms it is also the *correct privacy-law posture*, not just an
   engineering nicety: Firecrawl should have zero PII cross-border exposure surface at all, which
   sidesteps the Section 33 / Article 21 question for that vendor entirely.
2. **The LLM provider does receive CV content** (for keyword/YoE interpretation) and **application-
   question text** (for answer drafting) — this is an unavoidable cross-border transfer given SDD
   §6.7's design (direct SDK call to Gemini or an OpenAI-compatible endpoint). Mitigate by: (a)
   selecting a provider/contract tier with a data-processing agreement that does not use API input
   for model training by default, (b) disclosing this transfer explicitly in the privacy policy
   (required regardless of Section 33's force, per DPP1's collection-notice and PDPA Article 8's
   equivalent notice duty), and (c) never sending the sensitive-field carve-out categories
   (`sensitive-questions.md`) to the LLM for drafting at all — those are routed to the user, not the
   model, which also minimizes what crosses the border in the first place.
3. **Do not send HKID/National-ID values or the CV photo to the LLM provider** even incidentally —
   if CV text extraction captures an ID number in a résumé's free text, the LLM interpretation prompt
   (`cv/interpret.ts`, T033) should redact/strip patterns matching HKID (`[A-Z]{1,2}[0-9]{6}[A0-9]`)
   and TW National ID (`[A-Z][12][0-9]{8}`) formats before the CV text is sent to the LLM, not just
   after — the field should never reach the offshore processor even for extraction purposes, since
   there is no matching/drafting purpose that needs it.

---

## 6. Access and erasure rights — what the app must support

**HK DPP6**: data subjects have *"the right to request access to and correction of their own personal
data,"* with reasoned refusals required if denied.
**TW PDPA Article 3**: enumerates the right to inquire/review, request a copy, correct/supplement,
demand cessation of collection/processing/use, and **erase** personal data — a broader, more explicit
list than HK's.

**Concrete product requirements**:
- `GET /profile/cv` and `GET /profile` (already in the SDD contract, §8) satisfy the access right —
  keep them returning the *actual* stored data, not a derived summary, so "access" is meaningful.
- A **self-service account/CV deletion path** is required to satisfy TW PDPA Article 3's erasure
  right and HK DPP2's "not kept longer than necessary" duty — this should be reachable from
  `ios/Fyndra/Features/Settings/` (not support-ticket-only), triggering the retention clock in §4.
- **Correction**: FR-003's existing design (user confirms/edits CV-derived keywords, corrections
  "never applied silently") already satisfies DPP6/Article 3's correction right for the derived
  profile; the underlying uploaded CV file itself should also be replaceable (re-upload), not just
  the derived fields.
- **Cessation without full deletion**: TW PDPA Article 3 additionally grants a right to *demand
  cessation of collection/processing/use* short of erasure — this maps to pausing job matching /
  auto-submit for an account without deleting the CV outright; a "pause my applications" toggle in
  Settings would satisfy this more precisely than deletion-only.

---

## 7. Recommended policy defaults (summary for `PrivacyInfo.xcprivacy` / privacy policy drafting)

| Item | Recommendation | Basis |
|---|---|---|
| CV/résumé retention | Until account deletion + 30 days, then hard delete | §4 |
| Inactive-account CV retention | Reminder at 12 months idle, no silent auto-delete | §4 |
| Sensitive answers (visa/HKID/salary/demographic) | Never added to the answer-reuse cache; excluded from any structured retention beyond the single application record | §4, `sensitive-questions.md` |
| CV/profile PII to Firecrawl | Never — zero exposure | §5 |
| CV/profile PII to LLM provider | Yes, minimized — HKID/ID-number patterns and CV photo stripped before send; sensitive-field categories never sent for drafting | §5 |
| Cross-border transfer disclosure | Explicit in privacy policy regardless of PDPO §33/PDPA Art.21 enforcement status | §5 |
| Access | `GET /profile`, `GET /profile/cv` return real stored data | §6 |
| Erasure | Self-service deletion in Settings, not support-ticket-only | §6 |
| Correction | Already satisfied by FR-003 (confirm/edit); extend to CV file re-upload | §6 |
| Processing cessation short of deletion | Recommend adding a "pause applications" toggle (new, not yet in SDD) | §6 |

Sources:
- [PCPD — Personal Data Protection Principles](https://www.pcpd.org.hk/english/data_privacy_law/ordinance_at_a_Glance/ordinance.html)
- [Taiwan Personal Data Protection Act (English) — Laws & Regulations Database, Ministry of Justice](https://law.moj.gov.tw/Eng/LawClass/LawAll.aspx?PCode=I0050021)
- [PDPC Taiwan — Article 21 interpretation](https://www.pdpc.gov.tw/en/News_Content/165/790/)
- [Baker McKenzie — Hong Kong international data transfer](https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/asia-pacific/hong-kong/topics/international-data-transfer)
- [Hogan Lovells — PCPD Model Contractual Clauses](https://www.hoganlovells.com/en/publications/hong-kong-pcpd-publishes-model-contractual-clauses-for-cross-border-data-transfers)
