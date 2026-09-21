import { prisma } from '../lib/prisma.js';
import { tokenize } from './segment.js';
import { expandToken } from './taxonomy/index.js';

export interface RankablePosting {
  title: string;
  requirementsSummary: string;
}

/**
 * Deterministic, zero-LLM keyword-overlap score (SDD §6.4 — no model call
 * at feed scale). Cross-lingual matching goes through the taxonomy's
 * `expandToken`, so an English CV keyword like "backend" scores against a
 * posting whose title contains the zh-Hant bigram "後端".
 *
 * Known scope limit: this does NOT weigh years-of-experience fit — that
 * would need a YoE *requirement* extracted from each job description,
 * which nothing in this codebase does yet (JobPosting has no such field).
 * Rather than fabricate a YoE score with no real signal behind it, this
 * scores on keyword/title overlap only. Add a YoE term once postings
 * actually carry an extracted requirement to compare against.
 */
export function computeMatchScore(profileKeywords: readonly string[], posting: RankablePosting): number {
  if (profileKeywords.length === 0) return 0;

  const profileTokens = new Set(profileKeywords.flatMap((k) => tokenize(k)).map((t) => t.toLowerCase()));
  const expandedProfile = new Set([...profileTokens].flatMap((t) => [...expandToken(t)]));

  const postingText = `${posting.title} ${posting.requirementsSummary}`;
  const postingTokens = new Set(tokenize(postingText).map((t) => t.toLowerCase()));
  // Title tokens count double — a role-title match matters more than an
  // incidental mention in a location/requirements string.
  const titleTokens = new Set(tokenize(posting.title).map((t) => t.toLowerCase()));

  let score = 0;
  for (const token of postingTokens) {
    const matched = expandedProfile.has(token) || [...expandToken(token)].some((eq) => expandedProfile.has(eq));
    if (matched) score += titleTokens.has(token) ? 2 : 1;
  }

  // Scaled so profiles/postings with more tokens aren't automatically
  // favoured — a Jaccard-like ratio against the smaller of the two sets.
  //
  // NOT bounded to 0..1, despite the ratio shape: a title token scores 2
  // while the denominator counts it once, so a posting whose title matches
  // the profile closely lands above 1.0. That is fine for ordering, which
  // is all this value is for, but it means no caller may treat it as a
  // percentage — the iOS client clamps it for display (JobPosting
  // .matchPercentage) after a real feed rendered "120% match".
  const denominator = Math.max(1, Math.min(expandedProfile.size, postingTokens.size));
  return score / denominator;
}

/** Rebuilds FeedEntry rows for one profile against its markets' current postings (T052 calls this). */
export async function rebuildFeedForProfile(profileId: string): Promise<number> {
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: profileId } });
  if (profile.markets.length === 0 || profile.keywords.length === 0) return 0;

  const postings = await prisma.jobPosting.findMany({ where: { market: { in: profile.markets } } });

  let written = 0;
  for (const posting of postings) {
    const matchScore = computeMatchScore(profile.keywords, posting);
    try {
      await prisma.feedEntry.upsert({
        where: { profileId_jobPostingId: { profileId, jobPostingId: posting.id } },
        create: { profileId, jobPostingId: posting.id, matchScore },
        update: { matchScore, rankedAt: new Date() },
      });
      written++;
    } catch (error) {
      // The posting list is read before the writes, so a posting can be
      // deleted underneath us mid-rebuild (retention sweep, a source going
      // away, a concurrent test file tearing down its fixtures). A vanished
      // posting simply has no feed entry — skip it rather than failing the
      // whole rebuild, which would leave the profile's feed half-written.
      if (isMissingPostingError(error)) continue;
      throw error;
    }
  }
  return written;
}

/** Prisma P2003 = foreign key constraint violated; here it can only be the posting. */
function isMissingPostingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2003'
  );
}
