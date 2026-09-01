import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { rebuildFeedForProfile } from '../matching/rank.js';
import { registerHandler } from './index.js';

const payloadSchema = z.object({ profileId: z.string().uuid().optional() });

/**
 * Recomputes FeedEntry rows. With a `profileId`, just that profile (used
 * when a user's keywords/markets change via PATCH /profile); without one,
 * every profile with enough data to rank against — the batch path the
 * crawl handler triggers after ingesting fresh postings.
 */
export async function handleRebuildMatch(payload: Prisma.JsonValue): Promise<void> {
  const { profileId } = payloadSchema.parse(payload ?? {});

  if (profileId) {
    await rebuildFeedForProfile(profileId);
    return;
  }

  const profiles = await prisma.userProfile.findMany({
    where: { markets: { isEmpty: false }, keywords: { isEmpty: false } },
    select: { id: true },
  });
  for (const profile of profiles) {
    await rebuildFeedForProfile(profile.id);
  }
}

export function registerRebuildMatchHandler(): void {
  registerHandler('rebuild_match', handleRebuildMatch);
}
