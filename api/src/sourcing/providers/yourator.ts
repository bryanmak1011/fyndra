import { assertAllowedHost, politeFetchJson } from '../provider.js';
import { stripUtmParams, type NormalisedPosting } from '../normalise.js';

// Yourator (yourator.co) — Taiwan startup/digital-role board. Public,
// unauthenticated `v4/jobs` API. Confirmed GO in
// specs/001-job-swipe-apply/compliance/source-assessment.md §2.
const ALLOWED_HOSTS = new Set(['www.yourator.co']);
const SITE_ORIGIN = 'https://www.yourator.co';
const API_PATH = '/api/v4/jobs';
const MAX_PAGES = 20;

interface YouratorJob {
  id: number;
  name: string;
  path: string;
  location: string;
  company: { brand: string };
  thirdPartyUrl: string | null;
}

interface YouratorResponse {
  payload: { hasMore: boolean; nextPage: number | null; jobs: YouratorJob[] };
}

/**
 * True for a string with no CJK characters — a cheap proxy for "this
 * title/summary is in English" until the real segmentation-based language
 * detector (matching/segment.ts) lands in a later phase. Good enough to
 * route a posting for feed display; not used for keyword extraction.
 */
function looksEnglish(text: string): boolean {
  return !/[一-鿿]/.test(text);
}

function toPosting(job: YouratorJob): NormalisedPosting {
  // Per career-ops's yourator.mjs design notes (SDD §6.3): the employer's
  // own ATS URL, UTM-stripped, is the de-duplication key when present;
  // the Yourator posting page is the fallback.
  const employerApplyUrl = job.thirdPartyUrl ? stripUtmParams(job.thirdPartyUrl) : null;

  return {
    sourceProvider: 'yourator',
    externalRef: String(job.id),
    employerApplyUrl: employerApplyUrl ?? `${SITE_ORIGIN}${job.path}`,
    title: job.name,
    employer: job.company.brand,
    requirementsSummary: job.location,
    language: looksEnglish(job.name) ? 'en' : 'zh_Hant',
    market: 'TW',
  };
}

export async function* fetchYouratorPostings(): AsyncGenerator<NormalisedPosting> {
  let page: number | null = 1;

  for (let pagesFetched = 0; page !== null && pagesFetched < MAX_PAGES; pagesFetched++) {
    const url = assertAllowedHost(`${SITE_ORIGIN}${API_PATH}?page=${page}`, ALLOWED_HOSTS);
    const { payload } = await politeFetchJson<YouratorResponse>(url);

    for (const job of payload.jobs) yield toPosting(job);

    page = payload.hasMore ? payload.nextPage : null;
  }
}
