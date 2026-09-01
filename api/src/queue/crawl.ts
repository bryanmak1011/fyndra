import { ingestAll, type IngestSummary } from '../sourcing/ingest.js';
import { fetchYouratorPostings } from '../sourcing/providers/yourator.js';
import { fetchGreenhousePostings } from '../sourcing/providers/ats/greenhouse.js';
import { fetchLeverPostings } from '../sourcing/providers/ats/lever.js';
import { fetchAshbyPostings } from '../sourcing/providers/ats/ashby.js';
import { fetchWorkablePostings } from '../sourcing/providers/ats/workable.js';
import { TRACKED_SOURCES } from '../sourcing/tracked-sources.js';
import { registerHandler, enqueue } from './index.js';
import { logger } from '../lib/logger.js';

const RECRAWL_INTERVAL_MS = 6 * 60 * 60 * 1000;

function addSummary(a: IngestSummary, b: IngestSummary): IngestSummary {
  return { created: a.created + b.created, updated: a.updated + b.updated, deduped: a.deduped + b.deduped };
}

/**
 * Crawls every tracked source (FR-004a: the feed itself only ever reads
 * from what's already in Postgres — this is the only place sourcing runs)
 * and re-schedules itself, so a single `crawl` enqueue keeps the feed
 * fresh indefinitely without a separate cron dependency.
 */
export async function handleCrawl(): Promise<void> {
  let summary: IngestSummary = { created: 0, updated: 0, deduped: 0 };

  if (TRACKED_SOURCES.yourator) {
    summary = addSummary(summary, await ingestAll(fetchYouratorPostings()));
  }
  for (const board of TRACKED_SOURCES.greenhouse) {
    summary = addSummary(summary, await ingestAll(fetchGreenhousePostings(board)));
  }
  for (const company of TRACKED_SOURCES.lever) {
    summary = addSummary(summary, await ingestAll(fetchLeverPostings(company)));
  }
  for (const jobBoard of TRACKED_SOURCES.ashby) {
    summary = addSummary(summary, await ingestAll(fetchAshbyPostings(jobBoard)));
  }
  for (const account of TRACKED_SOURCES.workable) {
    summary = addSummary(summary, await ingestAll(fetchWorkablePostings(account)));
  }

  logger.info('crawl_completed', { ...summary });
  await enqueue('rebuild_match', {});
  await enqueue('crawl', {}, new Date(Date.now() + RECRAWL_INTERVAL_MS));
}

export function registerCrawlHandler(): void {
  registerHandler('crawl', handleCrawl);
}
