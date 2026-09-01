// Bilingual skill/role taxonomy for cross-lingual matching at feed scale
// (an English CV against a Traditional Chinese JD or vice versa) — see
// SDD.md §10.2. Deliberately keyed on 2-character Chinese root terms
// rather than full compound phrases (e.g. "後端" not "後端工程師"): the
// tokenizer (matching/segment.ts) produces character *bigrams* for
// Han-script runs, not dictionary words, so a taxonomy entry only ever
// matches what the tokenizer can actually produce. "後端工程師" is covered
// by matching its constituent bigrams — 後端, 端工, 工程, 程師 — against
// the roots below, not as one indivisible phrase.
interface TaxonomyEntry {
  en: string[];
  zh: string[];
}

const TAXONOMY: TaxonomyEntry[] = [
  { en: ['backend'], zh: ['後端'] },
  { en: ['frontend'], zh: ['前端'] },
  { en: ['fullstack'], zh: ['全端'] },
  { en: ['software'], zh: ['軟體'] },
  { en: ['engineering', 'engineer'], zh: ['工程'] },
  { en: ['project'], zh: ['專案'] },
  { en: ['management', 'manager'], zh: ['管理'] },
  { en: ['product'], zh: ['產品'] },
  { en: ['data'], zh: ['資料', '數據'] },
  { en: ['database'], zh: ['資料庫', '數據庫'] },
  { en: ['cloud'], zh: ['雲端'] },
  { en: ['analysis', 'analyst'], zh: ['分析'] },
  { en: ['machine'], zh: ['機器'] },
  { en: ['learning'], zh: ['學習'] },
  { en: ['artificial'], zh: ['人工'] },
  { en: ['intelligence'], zh: ['智慧', '智能'] },
  { en: ['sales'], zh: ['業務', '銷售'] },
  { en: ['marketing'], zh: ['行銷'] },
  { en: ['finance', 'financial'], zh: ['財務', '金融'] },
  { en: ['accounting'], zh: ['會計'] },
  { en: ['design', 'designer'], zh: ['設計'] },
  { en: ['operations'], zh: ['營運'] },
  { en: ['senior'], zh: ['資深'] },
  { en: ['junior'], zh: ['初級'] },
  { en: ['remote'], zh: ['遠端'] },
  { en: ['mobile'], zh: ['行動'] },
  { en: ['security'], zh: ['資安', '安全'] },
  { en: ['testing', 'qa'], zh: ['測試'] },
  { en: ['interface'], zh: ['介面'] },
  { en: ['experience'], zh: ['體驗'] },
  { en: ['customer'], zh: ['客戶'] },
  { en: ['service'], zh: ['服務'] },
];

/** Every term (English or Chinese) mapped to its full equivalence set, self included. */
const equivalenceMap = new Map<string, Set<string>>();
for (const entry of TAXONOMY) {
  const allTerms = [...entry.en.map((t) => t.toLowerCase()), ...entry.zh];
  const group = new Set(allTerms);
  for (const term of allTerms) equivalenceMap.set(term, group);
}

/** Returns `token` plus any cross-lingual equivalents the taxonomy knows about. */
export function expandToken(token: string): Set<string> {
  return equivalenceMap.get(token.toLowerCase()) ?? new Set([token.toLowerCase()]);
}

/** True if any of `a`'s tokens taxonomy-match any of `b`'s tokens (same term or a known equivalent). */
export function haveSharedMeaning(tokensA: readonly string[], tokensB: readonly string[]): boolean {
  const expandedA = new Set(tokensA.flatMap((t) => [...expandToken(t)]));
  return tokensB.some((t) => [...expandToken(t)].some((eq) => expandedA.has(eq)));
}
