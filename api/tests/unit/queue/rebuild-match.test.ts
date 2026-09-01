import { prisma } from '../../../src/lib/prisma.js';
import { handleRebuildMatch } from '../../../src/queue/rebuild-match.js';

async function seedProfile(email: string, markets: string[], keywords: string[]) {
  return prisma.userProfile.create({ data: { email, markets, keywords } });
}

async function seedPosting(market: 'HK' | 'TW', title: string) {
  return prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-rebuild-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      title,
      employer: 'TestCo',
      requirementsSummary: '',
      language: 'en',
      market,
      applyRoute: 'handoff',
    },
  });
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-rebuild-seed' } });
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-rebuild-' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('handleRebuildMatch', () => {
  it('rebuilds only the given profileId when one is provided', async () => {
    const profile = await seedProfile(`test-rebuild-single-${Date.now()}@example.com`, ['HK'], ['TypeScript']);
    const posting = await seedPosting('HK', 'Backend Engineer');

    await handleRebuildMatch({ profileId: profile.id });

    const entries = await prisma.feedEntry.findMany({ where: { profileId: profile.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0].jobPostingId).toBe(posting.id);
  });

  it('batch mode (no profileId) rebuilds every profile with markets and keywords set', async () => {
    const eligible = await seedProfile(`test-rebuild-batch-a-${Date.now()}@example.com`, ['HK'], ['TypeScript']);
    const noMarkets = await seedProfile(`test-rebuild-batch-b-${Date.now()}@example.com`, [], ['TypeScript']);
    const noKeywords = await seedProfile(`test-rebuild-batch-c-${Date.now()}@example.com`, ['HK'], []);
    await seedPosting('HK', 'Backend Engineer');

    await handleRebuildMatch({});

    expect(await prisma.feedEntry.count({ where: { profileId: eligible.id } })).toBeGreaterThan(0);
    expect(await prisma.feedEntry.count({ where: { profileId: noMarkets.id } })).toBe(0);
    expect(await prisma.feedEntry.count({ where: { profileId: noKeywords.id } })).toBe(0);
  });

  it('accepts an empty payload the same as batch mode', async () => {
    const profile = await seedProfile(`test-rebuild-empty-${Date.now()}@example.com`, ['TW'], ['Go']);
    await seedPosting('TW', 'Go Engineer');

    await expect(handleRebuildMatch(null)).resolves.not.toThrow();
    expect(await prisma.feedEntry.count({ where: { profileId: profile.id } })).toBeGreaterThan(0);
  });
});
