import type { Language, Market } from '@prisma/client';

// Canonical shape every provider maps its source's response into, before
// it's written to JobPosting. Kept intentionally small — see data-model.md.
export interface NormalisedPosting {
  sourceProvider: string;
  externalRef: string;
  employerApplyUrl: string | null;
  title: string;
  employer: string;
  requirementsSummary: string;
  language: Language;
  market: Market;
}

const UTM_PREFIX = 'utm_';

// FR-016b: strip ad-campaign attribution before a URL becomes the dedup
// key, so the same role reached via a paid placement and via the
// employer's own ATS link collapse to one posting. Adopted from
// career-ops's yourator.mjs design notes — see SDD.md §6.3.
export function stripUtmParams(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return null;
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith(UTM_PREFIX)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return null;
  }
}
