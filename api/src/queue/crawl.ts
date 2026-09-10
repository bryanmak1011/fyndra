import { ingestAll, type IngestSummary } from '../sourcing/ingest.js';
import { fetchJobsdbHkPostings } from '../sourcing/providers/jobsdb-hk.js';
import { fetchTw104Postings } from '../sourcing/providers/tw104.js';
import { registerHandler, enqueue } from './index.js';
import { logger } from '../lib/logger.js';

const RECRAWL_INTERVAL_MS = 6 * 60 * 60 * 1000;

function addSummary(a: IngestSummary, b: IngestSummary): IngestSummary {
  return { created: a.created + b.created, updated: a.updated + b.updated, deduped: a.deduped + b.deduped };
}

/**
 * Crawls both markets (FR-004a: the feed itself only ever reads from
 * what's already in Postgres — this is the only place sourcing runs) and
 * re-schedules itself, so a single `crawl` enqueue keeps the feed fresh
 * indefinitely without a separate cron dependency.
 *
 * 2026-09-10: sourcing narrowed to JobsDB HK + 104.com.tw only (via
 * Apify — see sourcing/providers/jobsdb-hk.ts and tw104.ts). Yourator and
 * the Greenhouse/Lever/Ashby/Workable ATS-tracked-company crawl were
 * dropped per product direction — these two market-wide boards cover far
 * more HK/TW roles than a curated company list. See BLOCKERS.md.
 */
export async function handleCrawl(): Promise<void> {
  let summary: IngestSummary = { created: 0, updated: 0, deduped: 0 };

  summary = addSummary(summary, await ingestAll(fetchJobsdbHkPostings()));
  summary = addSummary(summary, await ingestAll(fetchTw104Postings()));

  logger.info('crawl_completed', { ...summary });
  await enqueue('rebuild_match', {});
  await enqueue('crawl', {}, new Date(Date.now() + RECRAWL_INTERVAL_MS));
}

export function registerCrawlHandler(): void {
  registerHandler('crawl', handleCrawl);
}
