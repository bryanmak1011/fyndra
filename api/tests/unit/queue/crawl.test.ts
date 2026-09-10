import { prisma } from '../../../src/lib/prisma.js';
import { handleCrawl } from '../../../src/queue/crawl.js';
import { JOBSDB_HK_QUERIES } from '../../../src/sourcing/providers/jobsdb-hk.js';
import { TW104_QUERIES } from '../../../src/sourcing/providers/tw104.js';

// Mocks the network boundary (the Apify REST API), not the provider
// modules themselves — so this exercises the real handleCrawl ->
// ingestAll -> each real provider's parsing/normalisation code, same
// approach as the pre-pivot version of this file. Empty results from
// every actor call by default; individual tests override `jobsByActor`
// for the one actor they care about.
function respondFor(url: string, jobsByActor: Partial<Record<string, unknown>>): Response {
  if (url.includes('shahidirfan~jobsdb-scraper')) {
    return new Response(JSON.stringify(jobsByActor.jobsdbHk ?? []), { status: 200 });
  }
  if (url.includes('youfuxu~taiwan-104-job-scraper')) {
    return new Response(JSON.stringify(jobsByActor.tw104 ?? []), { status: 200 });
  }
  throw new Error(`unexpected fetch in crawl.test.ts: ${url}`);
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
  it('queries every seed keyword for both markets exactly once and reschedules itself plus a rebuild_match job', async () => {
    const queriedActors: string[] = [];
    global.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      queriedActors.push(url.includes('jobsdb-scraper') ? 'jobsdb-hk' : 'tw104');
      return respondFor(url, {});
    }) as typeof fetch;

    await handleCrawl();

    const jobsdbCalls = queriedActors.filter((a) => a === 'jobsdb-hk').length;
    const tw104Calls = queriedActors.filter((a) => a === 'tw104').length;
    expect(jobsdbCalls).toBe(JOBSDB_HK_QUERIES.length);
    expect(tw104Calls).toBe(TW104_QUERIES.length);

    expect(await prisma.queueJob.findFirst({ where: { type: 'rebuild_match' } })).not.toBeNull();

    const nextCrawlJob = await prisma.queueJob.findFirst({
      where: { type: 'crawl' },
      orderBy: { createdAt: 'desc' },
    });
    expect(nextCrawlJob).not.toBeNull();
    expect(nextCrawlJob!.runAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('actually ingests real postings from both markets into JobPosting', async () => {
    global.fetch = (async (input: RequestInfo | URL) =>
      respondFor(String(input), {
        jobsdbHk: [
          {
            id: '999999',
            url: 'https://hk.jobsdb.com/job/999999',
            title: 'Test Crawl Engineer',
            company: 'TestCo HK',
            location: 'Central',
            Description_text: 'Build things.',
          },
        ],
        tw104: [
          {
            jobId: 'testref1',
            jobUrl: 'https://www.104.com.tw/job/testref1',
            jobName: 'Test Crawl Engineer TW',
            company: 'TestCo TW',
            area: '台北市',
            shortDescription: '打造產品',
          },
        ],
      })) as typeof fetch;

    await handleCrawl();

    const hkPosting = await prisma.jobPosting.findFirst({
      where: { sourceProvider: 'jobsdb-hk', externalRef: '999999' },
    });
    expect(hkPosting).not.toBeNull();
    expect(hkPosting?.title).toBe('Test Crawl Engineer');
    expect(hkPosting?.market).toBe('HK');

    const twPosting = await prisma.jobPosting.findFirst({
      where: { sourceProvider: 'tw104', externalRef: 'testref1' },
    });
    expect(twPosting).not.toBeNull();
    expect(twPosting?.title).toBe('Test Crawl Engineer TW');
    expect(twPosting?.market).toBe('TW');

    await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'jobsdb-hk', externalRef: '999999' } });
    await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'tw104', externalRef: 'testref1' } });
  });
});
