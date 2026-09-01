import { assertAllowedHost, politeFetchJson } from '../../provider.js';
import type { NormalisedPosting } from '../../normalise.js';
import { detectLanguage } from '../../../matching/segment.js';
import { detectMarket } from './location.js';

// Lever's public postings API — GO in compliance/source-assessment.md §9.
const ALLOWED_HOSTS = new Set(['api.lever.co']);

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  categories: { location?: string; allLocations?: string[] };
  country?: string;
}

function toPosting(company: string, posting: LeverPosting): NormalisedPosting | null {
  const locationCandidates = [
    posting.country,
    posting.categories.location,
    ...(posting.categories.allLocations ?? []),
  ];
  const market = detectMarket(locationCandidates);
  if (!market) return null;

  return {
    sourceProvider: 'lever',
    externalRef: posting.id,
    employerApplyUrl: posting.hostedUrl,
    title: posting.text,
    employer: company,
    requirementsSummary: posting.categories.location ?? '',
    language: detectLanguage(posting.text),
    market,
  };
}

export async function* fetchLeverPostings(company: string): AsyncGenerator<NormalisedPosting> {
  const url = assertAllowedHost(`https://api.lever.co/v0/postings/${company}?mode=json`, ALLOWED_HOSTS);
  const postings = await politeFetchJson<LeverPosting[]>(url);

  for (const posting of postings) {
    const normalised = toPosting(company, posting);
    if (normalised) yield normalised;
  }
}
