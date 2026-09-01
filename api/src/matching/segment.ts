export type DetectedLanguage = 'zh_Hant' | 'en' | 'mixed';

// CJK Unified Ideographs + Extension A — covers Traditional Chinese as
// used on HK/TW CVs and job postings. Not exhaustive of every CJK block
// (no Hangul/Kana), which is fine: this product's two markets are HK/TW.
const HAN_CHAR = /[一-鿿㐀-䶿]/g;
const LATIN_WORD = /[A-Za-z][A-Za-z0-9+.#-]*/g;

/**
 * SDD R5: the failure mode to avoid is *silent* under-extraction on
 * Chinese text — whitespace tokenisation returns a near-empty result on
 * CJK instead of failing loudly, which ships invisibly broken. Detecting
 * the language first, and routing to a CJK-aware tokenizer below, is what
 * closes that gap.
 */
export function detectLanguage(text: string): DetectedLanguage {
  const hanCount = (text.match(HAN_CHAR) ?? []).length;
  const latinCount = (text.match(LATIN_WORD) ?? []).length;

  if (hanCount === 0) return 'en';
  if (latinCount === 0) return 'zh_Hant';

  // Whichever script accounts for a clear majority of "content" wins;
  // otherwise it's a genuinely bilingual document.
  const total = hanCount + latinCount;
  if (hanCount / total > 0.7) return 'zh_Hant';
  if (latinCount / total > 0.7) return 'en';
  return 'mixed';
}

/**
 * ponytail: character-bigram tokenisation for the Han-script portion,
 * not dictionary-based word segmentation (no jieba-equivalent here).
 * This is a real, standard fallback technique for CJK IR when no
 * dictionary is available — it over-generates tokens rather than
 * under-extracting, which is the correct failure direction for this
 * product (a spurious keyword is harmless; a missed one silently breaks
 * matching, per R5). Upgrade path: swap in a proper dictionary-based
 * segmenter (e.g. a jieba port) if match quality demands it — nothing
 * downstream depends on token *count*, only on non-empty, meaningful
 * tokens existing.
 */
function tokenizeHan(text: string): string[] {
  const runs = text.match(new RegExp(`${HAN_CHAR.source}+`, 'g')) ?? [];
  const tokens: string[] = [];
  for (const run of runs) {
    if (run.length === 1) {
      tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      tokens.push(run.slice(i, i + 2));
    }
  }
  return tokens;
}

function tokenizeLatin(text: string): string[] {
  return (text.match(LATIN_WORD) ?? []).map((w) => w.toLowerCase());
}

/** Tokenizes CJK and Latin spans independently, then combines. */
export function tokenize(text: string): string[] {
  return [...tokenizeHan(text), ...tokenizeLatin(text)];
}
