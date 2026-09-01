// Classifies application-form questions against the 5 protected categories
// in compliance/sensitive-questions.md (T006 — the testable spec this
// implements). Scope: this module only decides whether a question falls
// into one of those 5 categories. It does NOT decide general
// answerability — an ordinary question this module clears still may or
// may not get auto-answered by prefill.ts (T065) depending on whether the
// profile/CV actually has the data. "Fail-closed" here means: when a
// question sits ambiguously *within* one of the 5 categories (e.g. an
// age field that might really be years-of-experience), side with
// sensitive — not that every unrelated field is sensitive by default.
export type SensitiveCategory =
  | 'work_authorization'
  | 'visa_sponsorship'
  | 'national_id'
  | 'salary'
  | 'demographic';

export interface SensitivityResult {
  isSensitive: boolean;
  category: SensitiveCategory | null;
}

const NOT_SENSITIVE: SensitivityResult = { isSensitive: false, category: null };

function lower(s: string): string {
  return s.toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// --- Category 1: work authorization / right to work ------------------------
const WORK_AUTH_EN = [
  /authorized to work/i,
  /legal right to work/i,
  /right to work in (hong kong|taiwan)/i,
  /work permit/i,
  /employment permit/i,
  /legally eligible for employment/i,
  /require a work permit/i,
  /eligible to work without restriction/i,
];
// "工作" co-occurring with one of {許可, 資格, 簽證, 權} — per the spec's
// matching note, not exact phrases.
const WORK_AUTH_ZH_COOCCUR = /工作.{0,6}(許可|資格|簽證|權)|(許可|資格|簽證|權).{0,6}工作/;

function isWorkAuthorization(text: string): boolean {
  return matchesAny(text, WORK_AUTH_EN) || WORK_AUTH_ZH_COOCCUR.test(text);
}

// --- Category 2: visa sponsorship -------------------------------------------
const SPONSORSHIP_EN = [
  /require.{0,15}sponsorship/i,
  /now or in the future.{0,20}sponsorship/i,
  /need sponsorship to work/i,
  /employment visa sponsorship/i,
  /immigration status/i,
];
const RELOCATION_WITH_VISA_EN = /relocation/i;
const VISA_CONTEXT_EN = /visa|immigration/i;
// Any hit on sponsorship/擔保/贊助 is sensitive per the spec, with or without visa context.
const SPONSORSHIP_ZH = /擔保|贊助/;
const IMMIGRATION_ZH = /移民身[分份]/;
// "employer/company provides ... visa" — a sponsorship signal even
// without the literal 擔保/贊助 words (e.g. "是否需要僱主提供工作簽證").
const SPONSORSHIP_ZH_PROVIDE = /(僱主|公司).{0,4}提供.*簽證/;

function isVisaSponsorship(text: string): boolean {
  if (matchesAny(text, SPONSORSHIP_EN)) return true;
  if (RELOCATION_WITH_VISA_EN.test(text) && VISA_CONTEXT_EN.test(text)) return true;
  if (SPONSORSHIP_ZH.test(text) || IMMIGRATION_ZH.test(text) || SPONSORSHIP_ZH_PROVIDE.test(text)) return true;
  return false;
}

// --- Category 3: national ID / passport -------------------------------------
const NATIONAL_ID_EN = [
  /\bhkid\b/i,
  /hong kong identity card/i,
  /\bid card number\b/i,
  /national id(entification)?( number)?/i,
  /taiwan id number/i,
  /\barc number\b/i,
  /passport number/i,
];
const NATIONAL_ID_ZH = [/身[分份]證字號/, /香港身份證號碼/, /統一證號/, /居留證號碼/, /護照號碼/, /身份證/];

// Format-pattern backstop (spec: run independent of question text). HKID
// check digits are commonly displayed either bare (A1234567) or
// parenthesised (A123456(7)) — both are the same real-world format.
const HKID_FORMAT = /^[A-Z]{1,2}[0-9]{6}\(?[0-9A]\)?$/;
const TW_NATIONAL_ID_FORMAT = /^[A-Z][12][0-9]{8}$/;

function isNationalId(text: string, fieldFormatHint?: string): boolean {
  if (matchesAny(text, NATIONAL_ID_EN)) return true;
  if (NATIONAL_ID_ZH.some((p) => p.test(text))) return true;
  if (fieldFormatHint && (HKID_FORMAT.test(fieldFormatHint) || TW_NATIONAL_ID_FORMAT.test(fieldFormatHint))) {
    return true;
  }
  return false;
}

// --- Category 4: expected/desired salary ------------------------------------
const SALARY_EN = [
  /expected salary/i,
  /salary expectations?/i,
  /desired salary/i,
  /current salary/i,
  /current compensation/i,
  /salary requirement/i,
  /expected monthly salary/i,
  /compensation expectations?/i,
];
// 薪資/待遇 co-occurring with 期望/希望/要求 (expected/desired/required) or
// 目前/現職 (current) — both framings are salary-negotiation-sensitive.
const SALARY_ZH_COOCCUR =
  /(薪資|待遇).{0,4}(期望|希望|要求|目前|現職)|(期望|希望|要求|目前|現職).{0,4}(薪資|待遇)/;
const SALARY_ZH_BARE = /^(薪資|待遇|月薪)$/; // exact bare field label, per spec's numeric/range-field note

function isSalary(text: string, fieldTypeHint?: 'numeric' | 'range' | 'text'): boolean {
  if (matchesAny(text, SALARY_EN)) return true;
  if (SALARY_ZH_COOCCUR.test(text)) return true;
  if ((fieldTypeHint === 'numeric' || fieldTypeHint === 'range') && SALARY_ZH_BARE.test(text.trim())) {
    return true;
  }
  return false;
}

// --- Category 5: demographics ------------------------------------------------
const ALWAYS_DEMOGRAPHIC_EN = [/\bgender\b/i, /\bsex\b/i, /\breligion\b/i, /religious affiliation/i, /marital status/i, /\bmarried\b/i, /\bsingle\b/i, /nationality/i, /number of children/i, /\bdependents\b/i];
const ALWAYS_DEMOGRAPHIC_ZH = [/性別/, /宗教/, /婚姻狀況/, /國籍/, /子女人數/, /扶養人數/];
const AGE_EN = /\bage\b|date of birth|\bdob\b/i;
const AGE_ZH = /出生日期|出生年月日|年齡/;
const DOB_FORMAT_HINT = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/; // DD/MM/YYYY-style, per spec's disambiguation
const YEARS_EXPERIENCE_HINT = /years? of experience|工作經驗|年資/i;

function isDemographic(text: string, fieldFormatHint?: string): boolean {
  if (matchesAny(text, ALWAYS_DEMOGRAPHIC_EN)) return true;
  if (ALWAYS_DEMOGRAPHIC_ZH.some((p) => p.test(text))) return true;

  if (AGE_EN.test(text) || AGE_ZH.test(text)) {
    // Disambiguate against a mislabeled years-of-experience field: only
    // clear it if the question text itself clearly says "experience" AND
    // there's no DOB-shaped format hint. Otherwise fail closed (sensitive).
    const looksLikeExperience = YEARS_EXPERIENCE_HINT.test(text);
    const looksLikeDob = fieldFormatHint ? DOB_FORMAT_HINT.test(fieldFormatHint) : false;
    if (looksLikeExperience && !looksLikeDob) return false;
    return true; // ambiguous or clearly DOB-shaped — sensitive
  }
  return false;
}

export interface ClassifyOptions {
  /** The ATS's own field-type/format metadata, when available (spec point 2/3). */
  fieldFormatHint?: string;
  fieldTypeHint?: 'numeric' | 'range' | 'text';
}

/**
 * Runs bilingual matching against all 5 categories in taxonomy order.
 * Returns the first category matched (categories are treated as mutually
 * exclusive for the purpose of this result — a question is routed once).
 */
export function classifyQuestion(questionText: string, options: ClassifyOptions = {}): SensitivityResult {
  const text = questionText.trim();
  if (!text) return NOT_SENSITIVE;

  // National ID first (highest-precision signal), then visa sponsorship
  // before work authorization — the spec notes "工作簽證"-style phrasing
  // overlaps both categories, and a sponsorship-specific signal (需要,
  // 提供, 贊助, 擔保) is the more precise read when both are present.
  if (isNationalId(text, options.fieldFormatHint)) return { isSensitive: true, category: 'national_id' };
  if (isVisaSponsorship(lower(text))) return { isSensitive: true, category: 'visa_sponsorship' };
  if (isWorkAuthorization(lower(text))) return { isSensitive: true, category: 'work_authorization' };
  if (isSalary(text, options.fieldTypeHint)) return { isSensitive: true, category: 'salary' };
  if (isDemographic(text, options.fieldFormatHint)) return { isSensitive: true, category: 'demographic' };

  return NOT_SENSITIVE;
}
