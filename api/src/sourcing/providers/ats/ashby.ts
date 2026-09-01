import { assertAllowedHost, politeFetchJson } from '../../provider.js';
import type { NormalisedPosting } from '../../normalise.js';
import { detectLanguage } from '../../../matching/segment.js';
import { detectMarket } from './location.js';

// Ashby's public Job Board API — GO in compliance/source-assessment.md §9.
const ALLOWED_HOSTS = new Set(['api.ashbyhq.com']);

interface AshbyAddress {
  postalAddress?: { addressCountry?: string; addressRegion?: string; addressLocality?: string };
}

interface AshbyJob {
  id: string;
  title: string;
  location: string;
  jobUrl: string;
  applyUrl: string;
  address?: AshbyAddress;
  secondaryLocations?: Array<{ location: string; address?: AshbyAddress }>;
}

interface AshbyResponse {
  jobs: AshbyJob[];
}

function addressCandidates(address: AshbyAddress | undefined): string[] {
  const p = address?.postalAddress;
  return [p?.addressCountry, p?.addressRegion, p?.addressLocality].filter((v): v is string => Boolean(v));
}

function toPosting(company: string, job: AshbyJob): NormalisedPosting | null {
  const candidates = [
    job.location,
    ...addressCandidates(job.address),
    ...(job.secondaryLocations ?? []).flatMap((loc) => [loc.location, ...addressCandidates(loc.address)]),
  ];
  const market = detectMarket(candidates);
  if (!market) return null;

  return {
    sourceProvider: 'ashby',
    externalRef: job.id,
    employerApplyUrl: job.jobUrl,
    title: job.title,
    employer: company,
    requirementsSummary: job.location,
    language: detectLanguage(job.title),
    market,
  };
}

export async function* fetchAshbyPostings(jobBoardName: string): AsyncGenerator<NormalisedPosting> {
  const url = assertAllowedHost(
    `https://api.ashbyhq.com/posting-api/job-board/${jobBoardName}`,
    ALLOWED_HOSTS,
  );
  const { jobs } = await politeFetchJson<AshbyResponse>(url);

  for (const job of jobs) {
    const posting = toPosting(jobBoardName, job);
    if (posting) yield posting;
  }
}
