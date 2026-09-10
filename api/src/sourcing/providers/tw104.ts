import { config } from '../../config/index.js';
import { createApifyClient } from '../apify-client.js';
import { detectLanguage } from '../../matching/segment.js';
import { stripUtmParams, type NormalisedPosting } from '../normalise.js';

// 104.com.tw (Taiwan), via the Apify actor `youfuxu/taiwan-104-job-scraper`.
// Direct fetch returns HTTP 403 on every request (source-assessment.md §3,
// BLOCKERS.md 2026-09-01) — unlike JobsDB HK, this is a genuinely
// different risk (the actor's own build traceback confirms it uses
// browser automation, i.e. it's actively working around 104.com.tw's bot
// detection, not just replaying a public API request shape). Proceeding
// via this actor was an explicit, informed product decision — see
// compliance/risk-acceptance-log.md's 2026-09-10 entry, not something
// inferred here. Live-verified 2026-09-10 before this provider was
// written: real postings returned with real field names.
const ACTOR_ID = 'youfuxu~taiwan-104-job-scraper';

// Seed set of broad role categories — analogous to the old
// tracked-sources.ts company list, grown by product over time rather
// than fabricated here. Kept small: each keyword is one paid actor run.
export const TW104_QUERIES: readonly string[] = ['軟體工程師', '產品經理', '行銷', '會計', '客服', '資料分析'];

const RESULTS_PER_QUERY = 20;

interface Tw104Job {
  jobId: string;
  jobUrl: string;
  jobName: string;
  company: string;
  area: string;
  shortDescription: string;
}

function toPosting(job: Tw104Job): NormalisedPosting {
  return {
    sourceProvider: 'tw104',
    externalRef: job.jobId,
    // 104.com.tw doesn't expose a separate employer-ATS link either —
    // the 104 job page itself is the real apply destination.
    employerApplyUrl: stripUtmParams(job.jobUrl) ?? job.jobUrl,
    title: job.jobName,
    employer: job.company,
    requirementsSummary: job.area,
    language: detectLanguage(`${job.jobName} ${job.shortDescription}`),
    market: 'TW',
  };
}

export async function* fetchTw104Postings(
  queries: readonly string[] = TW104_QUERIES,
): AsyncGenerator<NormalisedPosting> {
  const client = createApifyClient({ apiToken: config.apifyApiToken });

  for (const keyword of queries) {
    const jobs = await client.runActorSync<Tw104Job>(ACTOR_ID, {
      keyword,
      maxItems: RESULTS_PER_QUERY,
      includeFullDescription: false,
    });
    for (const job of jobs) yield toPosting(job);
  }
}
