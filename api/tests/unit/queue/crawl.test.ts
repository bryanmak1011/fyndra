import { prisma } from '../../../src/lib/prisma.js';
import { handleCrawl } from '../../../src/queue/crawl.js';
import { TRACKED_SOURCES } from '../../../src/sourcing/tracked-sources.js';

// Mocks the network boundary (every provider's fetch call), not the
// provider modules themselves — so this exercises the real
// handleCrawl -> ingestAll -> each real provider's parsing/normalisation
// code, same as apply-flow.test.ts's approach. Empty results from every
// source by default; individual tests override `jobsByHost` for the one
// source they care about.
const HOST_RESPONDERS: Array<{
  fragment: string;
  key: string;
  body: (jobs: unknown) => unknown;
}> = [
  { fragment: 'yourator.co', key: 'yourator', body: (jobs) => ({ payload: { hasMore: false, nextPage: null, jobs: jobs ?? [] } }) },
  { fragment: 'greenhouse.io', key: 'greenhouse', body: (jobs) => ({ jobs: jobs ?? [] }) },
  { fragment: 'lever.co', key: 'lever', body: (jobs) => jobs ?? [] },
  { fragment: 'ashbyhq.com', key: 'ashby', body: (jobs) => ({ jobs: jobs ?? [] }) },
  { fragment: 'workable.com', key: 'workable', body: (jobs) => ({ name: 't', description: '', jobs: jobs ?? [] }) },
];

function respondFor(url: string, jobsByHost: Partial<Record<string, unknown>>): Response {
  const responder = HOST_RESPONDERS.find((r) => url.includes(r.fragment));
  if (!responder) throw new Error(`unexpected fetch in crawl.test.ts: ${url}`);
  return new Response(JSON.stringify(responder.body(jobsByHost[responder.key])), { status: 200 });
}

const originalFetch = global.fetch;
afterEach(async () => {
  global.fetch = originalFetch;
  await prisma.queueJob.deleteMany({ where: { type: { in: ['crawl', 'rebuild_match'] } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('handleCrawl', () => {
  it('queries every tracked source exactly once and reschedules itself plus a rebuild_match job', async () => {
    const queriedHosts: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      queriedHosts.push(new URL(url).hostname);
      return respondFor(url, {});
    }) as typeof fetch;

    await handleCrawl();

    for (const fragment of ['yourator.co', 'greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com']) {
      expect(queriedHosts.some((h) => h.includes(fragment))).toBe(true);
    }
    // One request per tracked entry.
    const expectedRequestCount =
      1 + // yourator (single board)
      TRACKED_SOURCES.greenhouse.length +
      TRACKED_SOURCES.lever.length +
      TRACKED_SOURCES.ashby.length +
      TRACKED_SOURCES.workable.length;
    expect(queriedHosts).toHaveLength(expectedRequestCount);

    expect(await prisma.queueJob.findFirst({ where: { type: 'rebuild_match' } })).not.toBeNull();

    const nextCrawlJob = await prisma.queueJob.findFirst({
      where: { type: 'crawl' },
      orderBy: { createdAt: 'desc' },
    });
    expect(nextCrawlJob).not.toBeNull();
    expect(nextCrawlJob!.runAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('actually ingests a real posting into JobPosting when a source returns one', async () => {
    global.fetch = (async (input: RequestInfo | URL) =>
      respondFor(String(input), {
        yourator: [
          {
            id: 999999,
            name: 'Test Crawl Engineer',
            path: '/companies/testco/jobs/999999',
            location: 'Taipei',
            company: { brand: 'TestCo' },
            thirdPartyUrl: null,
          },
        ],
      })) as typeof fetch;

    await handleCrawl();

    const posting = await prisma.jobPosting.findFirst({
      where: { sourceProvider: 'yourator', externalRef: '999999' },
    });
    expect(posting).not.toBeNull();
    expect(posting?.title).toBe('Test Crawl Engineer');

    await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'yourator', externalRef: '999999' } });
  });
});
