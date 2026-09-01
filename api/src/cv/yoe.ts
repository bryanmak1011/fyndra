// Deterministic years-of-experience extraction — no LLM call needed for
// the common, explicitly-stated case ("5+ years", "5年以上經驗"). The LLM
// interpretation step (interpret.ts) is reserved for cases this misses
// (YoE implied by a work-history date range, not stated as a number).
const EN_PATTERNS = [
  /(\d{1,2})\+?\s*years?\s*(?:of\s*)?experience/i,
  /(\d{1,2})\+?\s*yrs?\s*(?:of\s*)?experience/i,
];

// 5年以上工作經驗 / 5 年經驗 / 5年以上相關經驗 — "以上" (or more) is optional,
// "工作"/"相關" (work/relevant) qualifiers are optional, whitespace between
// the digit and 年 is optional.
const ZH_PATTERNS = [/(\d{1,2})\s*年(?:以上)?(?:工作|相關)?經驗/];

export function extractYearsOfExperience(text: string): number | null {
  for (const pattern of [...EN_PATTERNS, ...ZH_PATTERNS]) {
    const match = text.match(pattern);
    if (match) {
      const years = Number(match[1]);
      if (years >= 0 && years <= 60) return years;
    }
  }
  return null;
}
