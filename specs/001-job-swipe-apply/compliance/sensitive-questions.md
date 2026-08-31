# T006 — Sensitive-Question Taxonomy for HK/TW (specification for `apply/sensitive.ts`)

**Owner**: Functional Analyst · **Status**: Draft for review · **Date**: 2026-08-31
**Purpose**: This is the testable specification for FR-022 and `api/src/apply/sensitive.ts` (T063),
and the fixture source for `api/tests/unit/sensitive.test.ts` (T058). Every category below must force
`pending_needs_answer` in **both** `review_before_sending` and `auto_submit` modes (SDD §6.5.2), and
answers to these categories are **never** written to the answer-reuse cache
(`api/src/apply/answer-reuse.ts`, FR-021/FR-022). An unclassifiable question must fail closed —
treated as sensitive by default, per T063's stated design.

**How to read this document**: each category gives (a) what it covers and why it's carved out, (b)
English keyword/phrase patterns, (c) Traditional Chinese (zh-Hant) keyword/phrase patterns covering
both Hong Kong and Taiwan usage (the two markets sometimes phrase the same concept differently — both
are listed), and (d) matching notes for the engineer implementing the classifier.

---

## Category 1: Work authorization / right to work

**Why carved out**: a wrong auto-answer here can misrepresent the candidate's legal eligibility to
work, which is both a legal-exposure and a candidate-harm issue — this must always be the candidate's
own, deliberate statement.

**English patterns**:
- "are you authorized to work"
- "do you have the legal right to work"
- "right to work in Hong Kong" / "right to work in Taiwan"
- "work permit"
- "employment permit"
- "are you legally eligible for employment"
- "do you require a work permit"
- "eligible to work without restriction"

**Traditional Chinese patterns**:
- 工作許可 (work permit)
- 工作簽證 (work visa — overlaps Category 2, still route here if phrased as authorization)
- 是否有合法工作權利 / 合法工作權
- 有否香港身份證及有效之工作簽證 (HK-specific phrasing: "do you hold a HK ID and valid work visa")
- 是否具備在台工作資格 (TW-specific: "do you have working eligibility in Taiwan")
- 工作資格 (working eligibility)
- 需要工作許可證嗎

**Matching notes**: match on "工作" (work) + one of {許可, 資格, 簽證, 權} co-occurring in the same
question string, plus the English set above case-insensitively. Do not require exact phrase match —
use substring/keyword co-occurrence since form-question phrasing varies by ATS vendor.

---

## Category 2: Visa sponsorship status

**Why carved out**: distinct from Category 1 — this asks about *future* sponsorship need, a
forward-looking legal/immigration question with employer-cost implications; a wrong auto-answer can
disqualify a candidate or create a false representation of employer obligation.

**English patterns**:
- "will you now or in the future require sponsorship"
- "require visa sponsorship"
- "need sponsorship to work"
- "employment visa sponsorship"
- "does this role require relocation" (route to sensitive when paired with visa/sponsorship language;
  relocation alone without visa language is not automatically sensitive)
- "immigration status"

**Traditional Chinese patterns**:
- 簽證擔保 / 需要公司擔保簽證
- 是否需要僱主提供工作簽證
- 未來是否需要簽證贊助
- 移民身份 (immigration status)
- 需要擔保 (needs sponsorship — generic, match combined with 簽證 or 工作 context)

**Matching notes**: "sponsorship"/"擔保"/"贊助" co-occurring with "visa"/"簽證" or "immigration"/"移民" is
the strongest signal; treat any hit on "sponsorship"/擔保/贊助 alone (without visa context) as
sensitive too, fail-closed, since sponsorship almost always implies visa/immigration in an application
context.

---

## Category 3: Hong Kong ID number (HKID) / Taiwan National ID

**Why carved out**: a national identifier is a direct re-identification risk and, per
`privacy-policy-requirements.md` §5, must never be auto-extracted into a reusable field or sent to an
offshore LLM. Any form field asking for this value must always stop for the user, and the value must
never be cached for reuse across applications.

**English patterns**:
- "HKID" / "HKID number" / "Hong Kong Identity Card"
- "ID card number"
- "national ID" / "national identification number"
- "Taiwan ID number" / "ARC number" (Alien Resident Certificate — Taiwan work-visa ID equivalent for
  non-citizens; route here even though it is not the citizen National ID, same sensitivity class)
- "passport number" (route here too — government-issued identity number, same handling)

**Traditional Chinese patterns**:
- 身分證字號 / 身份證字號 (Taiwan National ID number — note both 分/份 spellings are in active use)
- 香港身份證號碼 / 香港身份證號碼(HKID)
- 統一證號 (Taiwan unified ID number — covers both citizen ID and ARC formats)
- 居留證號碼 (Alien Resident Certificate number, Taiwan)
- 護照號碼 (passport number)
- 身份證 (identity card — generic, high-precision term, use as a strong standalone signal)

**Matching notes**: additionally run a **format-pattern check independent of the surrounding question
text**, since some forms use a bare field label like "ID No." with no further context — flag any
input field whose expected format matches `^[A-Z]{1,2}[0-9]{6}[0-9A]$` (HKID) or
`^[A-Z][12][0-9]{8}$` (Taiwan National ID) as sensitive regardless of label-text confidence, since a
format match is close to unambiguous for this category. This is the one category where SDD §10.1 and
§6.5.2 explicitly name the field type, and it should have the lowest false-negative tolerance of all
six categories.

---

## Category 4: Expected / desired salary

**Why carved out**: salary expectation is negotiation-sensitive and personal; an auto-drafted number
can under- or over-state the candidate's actual position and cannot be corrected after submission —
this must always be the user's own figure.

**English patterns**:
- "expected salary" / "salary expectation(s)"
- "desired salary"
- "current salary" / "current compensation"
- "salary requirement"
- "expected monthly salary"
- "compensation expectations"

**Traditional Chinese patterns**:
- 期望薪資 (expected salary — the canonical HK/TW phrasing named explicitly in the SDD)
- 期望待遇
- 希望待遇
- 現職薪資 / 目前薪資 (current salary)
- 待遇要求
- 薪資要求
- 月薪期望 (expected monthly salary)
- 希望薪資

**Matching notes**: "薪資"/"待遇" (salary/compensation) co-occurring with "期望"/"希望"/"要求" (expected/
desired/required) is the core signal; also match "薪資"/"待遇" alone when the field type is numeric or
a range-selector, since some ATS forms label the field simply "薪資" or "Salary" with no qualifier.

---

## Category 5: Demographic questions

**Why carved out**: gender, age, marital status, and religion remain common on HK/TW application
forms (a regional norm that is increasingly discouraged but still live in practice, per the task
brief), and auto-answering any of these risks the app itself becoming an instrument of discriminatory
screening, independent of what the employer does with the answer. This category is the broadest and
should fail closed most readily.

**English patterns**:
- "gender" / "sex" (as a form field, not "job scope" false positives — see matching notes)
- "date of birth" / "DOB" / "age"
- "marital status" / "married" / "single" (as a status field)
- "religion" / "religious affiliation"
- "nationality" (borderline — see matching notes)
- "number of children" / "dependents"

**Traditional Chinese patterns**:
- 性別 (gender/sex)
- 出生日期 / 出生年月日 / 年齡 (date of birth / age)
- 婚姻狀況 (marital status)
- 宗教 / 宗教信仰 (religion)
- 國籍 (nationality — see matching notes)
- 子女人數 / 扶養人數 (number of children / dependents)

**Matching notes**:
- "Gender"/"性別" and "religion"/"宗教" should always match — there is no legitimate non-demographic
  use of these labels on an application form.
- "Age"/"年齡"/"DOB" should always match, **except** when the field is clearly a work-experience-years
  field (e.g. "years of experience" mislabeled) — disambiguate by checking for an accompanying date-of-
  birth format (`DD/MM/YYYY` style input) vs. a small-integer "years" field; when ambiguous, fail
  closed (sensitive).
- "Nationality"/"國籍" is borderline: in some HK/TW forms it is genuinely a work-authorization proxy
  (Category 1/2 territory) rather than a demographic-screening question. Route nationality questions
  to sensitive regardless of which underlying intent applies — the downstream handling
  (`pending_needs_answer`, user answers directly) is correct either way, so the classifier does not
  need to resolve the ambiguity, just catch it.
- "Marital status"/"婚姻狀況" should always match.

---

## Implementation guidance for `apply/sensitive.ts` (T063)

1. **Fail-closed default**: if a question does not match any category above with reasonable
   confidence, treat it as sensitive rather than attempting to draft an answer — per T063's existing
   design intent, this document confirms that default is correct and should not be weakened for
   coverage/completion-rate reasons.
2. **Bilingual matching runs on both the raw question text and, where the source ATS provides one, the
   field's semantic type/name** (e.g. Greenhouse custom-field metadata may label a field type distinct
   from its visible label) — match against both where available, since label text alone can be
   ambiguous or localized inconsistently across ATS vendors.
3. **Format-pattern checks (Category 3) run independently of keyword matching** — a field can be
   flagged sensitive by format alone even with no matching label text, since ID-number formats are the
   one place a false negative is especially costly.
4. **Test fixtures for T058 should include at least one example per category in English, one in
   Traditional Chinese (HK phrasing where it differs from TW), and one adversarial near-miss per
   category** (a question that sounds similar but is not actually sensitive, e.g. "years of
   experience" vs. "age," or "expected start date" vs. "expected salary") to confirm the classifier
   does not over-fire to the point of blocking the whole form, while still failing closed on genuine
   ambiguity.
5. **This taxonomy is not exhaustive by design** — HK/TW ATS forms will surface phrasings not listed
   here over time. `apply/sensitive.ts` should log unmatched-but-uncertain questions (ones that hit no
   category but also don't cleanly match a known-safe question type) for periodic human review, so
   this document can be extended rather than treated as frozen at launch.

---

## Category summary table

| # | Category | Never reused (answer-reuse cache) | Fail-closed on ambiguity |
|---|---|---|---|
| 1 | Work authorization / right to work | Yes | Yes |
| 2 | Visa sponsorship status | Yes | Yes |
| 3 | HKID / Taiwan National ID / passport / ARC number | Yes | Yes — format-pattern backstop |
| 4 | Expected / desired salary | Yes | Yes |
| 5 | Demographics (gender, age, marital status, religion, nationality, dependents) | Yes | Yes — broadest category, lowest match threshold |
