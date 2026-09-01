import { assertAllowedHost, politeFetchJson } from '../../provider.js';
import type { NormalisedPosting } from '../../normalise.js';
import { detectLanguage } from '../../../matching/segment.js';
import { detectMarket } from './location.js';

// Workable's public widget API — GO in compliance/source-assessment.md §9.
// Best-structured location data of the four ATS platforms (real
// countryCode per location), confirmed via live fixtures pulled from
// apply.workable.com/api/v1/widget/accounts/{suade,workmotion}.
const ALLOWED_HOSTS = new Set(['apply.workable.com']);

interface WorkableLocation {
  country?: string;
  countryCode?: string;
  city?: string;
}

interface WorkableJob {
  shortcode: string;
  title: string;
  application_url: string;
  country?: string;
  city?: string;
  locations?: WorkableLocation[];
}

interface WorkableResponse {
  jobs: WorkableJob[];
}

function toPosting(company: string, job: WorkableJob): NormalisedPosting | null {
  const candidates = [
    job.country,
    ...(job.locations ?? []).flatMap((loc) => [loc.countryCode, loc.country, loc.city]),
  ];
  const market = detectMarket(candidates);
  if (!market) return null;

  return {
    sourceProvider: 'workable',
    externalRef: job.shortcode,
    employerApplyUrl: job.application_url,
    title: job.title,
    employer: company,
    requirementsSummary: [job.city, job.country].filter(Boolean).join(', '),
    language: detectLanguage(job.title),
    market,
  };
}

export async function* fetchWorkablePostings(accountSlug: string): AsyncGenerator<NormalisedPosting> {
  const url = assertAllowedHost(
    `https://apply.workable.com/api/v1/widget/accounts/${accountSlug}`,
    ALLOWED_HOSTS,
  );
  const { jobs } = await politeFetchJson<WorkableResponse>(url);

  for (const job of jobs) {
    const posting = toPosting(accountSlug, job);
    if (posting) yield posting;
  }
}
