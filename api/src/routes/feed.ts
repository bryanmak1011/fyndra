import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const feedRouter = Router();

const LANGUAGE_TO_API = { en: 'en', zh_Hant: 'zh-Hant', mixed: 'mixed' } as const;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /jobs/feed (FR-004a) — Postgres-only read, ordered by the
// deterministic FeedEntry.matchScore computed offline by rank.ts; never
// triggers a live crawl, so a slow/blocked source can't slow a swipe.
feedRouter.get('/feed', async (req, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const { limit } = parsed.data;

  const entries = await prisma.feedEntry.findMany({
    where: {
      profileId: req.profileId!,
      jobPosting: { jobInteractions: { none: { profileId: req.profileId! } } }, // FR-014
    },
    orderBy: { matchScore: 'desc' },
    take: limit + 1, // one extra, to know whether more remain without a second count query
    include: { jobPosting: true },
  });

  const exhausted = entries.length <= limit;
  const page = entries.slice(0, limit);

  res.status(200).json({
    items: page.map((entry) => ({
      id: entry.jobPosting.id,
      sourceProvider: entry.jobPosting.sourceProvider,
      title: entry.jobPosting.title,
      employer: entry.jobPosting.employer,
      requirementsSummary: entry.jobPosting.requirementsSummary,
      language: LANGUAGE_TO_API[entry.jobPosting.language as keyof typeof LANGUAGE_TO_API],
      market: entry.jobPosting.market,
      applyRoute: entry.jobPosting.applyRoute,
      matchScore: entry.matchScore,
    })),
    exhausted,
  });
});
