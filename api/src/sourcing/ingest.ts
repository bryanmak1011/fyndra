import { prisma } from '../lib/prisma.js';
import { determineApplyRoute } from './apply-route.js';
import type { NormalisedPosting } from './normalise.js';

export type IngestOutcome = 'created' | 'updated' | 'deduped';

/**
 * Writes one normalised posting to the JobPosting table. FR-016b:
 * de-duplicates on `employerApplyUrl` *across* providers first — the same
 * role reached via a Taiwan board and via the employer's own Greenhouse
 * page collapses to one row — before falling back to each provider's own
 * (sourceProvider, externalRef) identity for postings without a resolvable
 * employer URL.
 */
export async function ingestPosting(posting: NormalisedPosting): Promise<IngestOutcome> {
  if (posting.employerApplyUrl) {
    const existing = await prisma.jobPosting.findFirst({
      where: { employerApplyUrl: posting.employerApplyUrl },
    });
    if (existing && existing.sourceProvider !== posting.sourceProvider) {
      // Same employer URL from a different provider than the one already
      // on file — the earlier row stays canonical; just mark it fresh.
      await prisma.jobPosting.update({ where: { id: existing.id }, data: { fetchedAt: new Date() } });
      return 'deduped';
    }
  }

  const applyRoute = determineApplyRoute(posting.employerApplyUrl);
  const existingBySource = await prisma.jobPosting.findUnique({
    where: { sourceProvider_externalRef: { sourceProvider: posting.sourceProvider, externalRef: posting.externalRef } },
  });

  await prisma.jobPosting.upsert({
    where: { sourceProvider_externalRef: { sourceProvider: posting.sourceProvider, externalRef: posting.externalRef } },
    create: { ...posting, applyRoute, fetchedAt: new Date() },
    update: { ...posting, applyRoute, fetchedAt: new Date() },
  });

  return existingBySource ? 'updated' : 'created';
}

export interface IngestSummary {
  created: number;
  updated: number;
  deduped: number;
}

export async function ingestAll(postings: AsyncIterable<NormalisedPosting>): Promise<IngestSummary> {
  const summary: IngestSummary = { created: 0, updated: 0, deduped: 0 };
  for await (const posting of postings) {
    const outcome = await ingestPosting(posting);
    summary[outcome]++;
  }
  return summary;
}
