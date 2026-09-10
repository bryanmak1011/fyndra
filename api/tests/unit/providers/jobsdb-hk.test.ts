import { fetchJobsdbHkPostings } from '../../../src/sourcing/providers/jobsdb-hk.js';

// Fixture shaped from a real live call to the Apify actor
// shahidirfan~jobsdb-scraper made 2026-09-10 before this provider was
// written (see BLOCKERS.md / compliance/risk-acceptance-log.md).
const REAL_FIXTURE = {
  id: '94019758',
  url: 'https://hk.jobsdb.com/job/94019758',
  title: 'Software Engineer (Insurtech)',
  company: 'MediConCen Limited',
  location: 'San Po Kong, Wong Tai Sin District',
  Description_text: 'Develop and maintain backend services and RESTful APIs using Node.js, TypeScript and NestJS.',
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchJobsdbHkPostings', () => {
  it('maps a real Apify actor response into a NormalisedPosting for the HK market', async () => {
    global.fetch = (async () => new Response(JSON.stringify([REAL_FIXTURE]), { status: 201 })) as typeof fetch;

    const postings = [];
    for await (const posting of fetchJobsdbHkPostings(['software engineer'])) postings.push(posting);

    expect(postings).toEqual([
      {
        sourceProvider: 'jobsdb-hk',
        externalRef: '94019758',
        employerApplyUrl: 'https://hk.jobsdb.com/job/94019758',
        title: 'Software Engineer (Insurtech)',
        employer: 'MediConCen Limited',
        requirementsSummary: 'San Po Kong, Wong Tai Sin District',
        language: 'en',
        market: 'HK',
      },
    ]);
  });

  it('queries the actor once per seed keyword, passing country=hk', async () => {
    const bodies: unknown[] = [];
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(init!.body as string));
      return new Response(JSON.stringify([]), { status: 201 });
    }) as typeof fetch;

    const postings = [];
    for await (const posting of fetchJobsdbHkPostings(['software engineer', 'marketing'])) postings.push(posting);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ country: 'hk', keyword: 'software engineer' });
    expect(bodies[1]).toMatchObject({ country: 'hk', keyword: 'marketing' });
  });

  it('detects Traditional Chinese postings, not just English', async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            ...REAL_FIXTURE,
            id: 'zh-1',
            title: '軟體工程師',
            Description_text: '負責開發後端服務與應用程式介面',
          },
        ]),
        { status: 201 },
      )) as typeof fetch;

    const postings = [];
    for await (const posting of fetchJobsdbHkPostings(['軟體工程師'])) postings.push(posting);

    expect(postings[0].language).toBe('zh_Hant');
  });
});
