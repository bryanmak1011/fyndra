import type { Market } from '@prisma/client';

// ATS platforms are global — a posting only belongs in this product's feed
// if it's actually based in Hong Kong or Taiwan. None of the four provide
// a single consistent structured field for this, so free-text matching
// against city/country strings (in whichever language they appear) is the
// common denominator; structured fields (ISO country codes, where present)
// are checked first since they're unambiguous.
const HK_TEXT_MARKERS = ['hong kong', 'hongkong', '香港'];
const TW_TEXT_MARKERS = ['taiwan', 'taipei', '台灣', '臺灣', '台北', '臺北'];

export function marketFromCountryCode(code: string | null | undefined): Market | null {
  if (code === 'HK') return 'HK';
  if (code === 'TW') return 'TW';
  return null;
}

export function marketFromLocationText(text: string | null | undefined): Market | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (HK_TEXT_MARKERS.some((m) => lower.includes(m))) return 'HK';
  if (TW_TEXT_MARKERS.some((m) => text.includes(m) || lower.includes(m))) return 'TW';
  return null;
}

/** Tries structured signals first, then free text; null means "not HK/TW — skip this posting". */
export function detectMarket(candidates: Array<string | null | undefined>): Market | null {
  for (const candidate of candidates) {
    const byCode = marketFromCountryCode(candidate);
    if (byCode) return byCode;
  }
  for (const candidate of candidates) {
    const byText = marketFromLocationText(candidate);
    if (byText) return byText;
  }
  return null;
}
