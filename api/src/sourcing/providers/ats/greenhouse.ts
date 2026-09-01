import { assertAllowedHost, politeFetchJson } from '../../provider.js';
import type { NormalisedPosting } from '../../normalise.js';
import { detectLanguage } from '../../../matching/segment.js';
import { detectMarket } from './location.js';

// Greenhouse Job Board API — public, documented, purpose-built for
// third-party consumption (compliance/source-assessment.md §9: GO).
// One "board token" per company (e.g. gitlab, stripe); we call one board
// per tracked company, filtering to HK/TW postings.
const ALLOWED_HOSTS = new Set(['boards-api.greenhouse.io']);

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location: { name: string };
  company_name: string;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

function toPosting(job: GreenhouseJob): NormalisedPosting | null {
  const market = detectMarket([job.location.name]);
  if (!market) return null;

  return {
    sourceProvider: 'greenhouse',
    externalRef: String(job.id),
    employerApplyUrl: job.absolute_url,
    title: job.title,
    employer: job.company_name,
    requirementsSummary: job.location.name,
    language: detectLanguage(job.title),
    market,
  };
}

export async function* fetchGreenhousePostings(boardToken: string): AsyncGenerator<NormalisedPosting> {
  const url = assertAllowedHost(
    `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=false`,
    ALLOWED_HOSTS,
  );
  const { jobs } = await politeFetchJson<GreenhouseResponse>(url);

  for (const job of jobs) {
    const posting = toPosting(job);
    if (posting) yield posting;
  }
}
