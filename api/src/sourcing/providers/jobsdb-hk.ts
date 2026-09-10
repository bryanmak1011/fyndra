import { config } from '../../config/index.js';
import { createApifyClient } from '../apify-client.js';
import { detectLanguage } from '../../matching/segment.js';
import { stripUtmParams, type NormalisedPosting } from '../normalise.js';

// JobsDB Hong Kong, via the Apify actor `shahidirfan/jobsdb-scraper` — see
// BLOCKERS.md 2026-09-01/2026-09-10 for why this isn't a direct fetch: a
// plain POST against SEEK's own v5 search API returned `Cannot POST`, and
// this actor already has the correct request shape figured out.
// Live-verified 2026-09-10 (real HK postings returned, real field names
// confirmed) before this provider was written — see
// compliance/risk-acceptance-log.md for the risk-acceptance entry this
// falls under (same ToS risk already accepted for T046, now proceeding
// via a third party instead of a direct fetch we couldn't safely probe
// for ourselves).
const ACTOR_ID = 'shahidirfan~jobsdb-scraper';

// Seed set of broad role categories — analogous to the old
// tracked-sources.ts company list, grown by product over time rather
// than fabricated here. Kept small: each keyword is one paid actor run.
export const JOBSDB_HK_QUERIES: readonly string[] = [
  'software engineer',
  'product manager',
  'data analyst',
  'marketing',
  'accountant',
  'customer service',
];

const RESULTS_PER_QUERY = 20;

interface JobsdbHkJob {
  id: string;
  url: string;
  title: string;
  company: string;
  location: string;
  Description_text: string;
}

function toPosting(job: JobsdbHkJob): NormalisedPosting {
  return {
    sourceProvider: 'jobsdb-hk',
    externalRef: job.id,
    // JobsDB doesn't expose a separate employer-ATS link in this
    // dataset (unlike Yourator's thirdPartyUrl) — the JobsDB posting
    // page itself is where a user actually applies, so it's both the
    // dedup key and the handoff destination.
    employerApplyUrl: stripUtmParams(job.url) ?? job.url,
    title: job.title,
    employer: job.company,
    requirementsSummary: job.location,
    language: detectLanguage(`${job.title} ${job.Description_text}`),
    market: 'HK',
  };
}

export async function* fetchJobsdbHkPostings(
  queries: readonly string[] = JOBSDB_HK_QUERIES,
): AsyncGenerator<NormalisedPosting> {
  const client = createApifyClient({ apiToken: config.apifyApiToken });

  for (const keyword of queries) {
    const jobs = await client.runActorSync<JobsdbHkJob>(ACTOR_ID, {
      country: 'hk',
      keyword,
      results_wanted: RESULTS_PER_QUERY,
      maxPagesPerList: 1,
    });
    for (const job of jobs) yield toPosting(job);
  }
}
