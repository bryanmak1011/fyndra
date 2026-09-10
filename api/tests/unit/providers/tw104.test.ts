import { fetchTw104Postings } from '../../../src/sourcing/providers/tw104.js';

// Fixture shaped from a real live call to the Apify actor
// youfuxu~taiwan-104-job-scraper made 2026-09-10 before this provider was
// written (see BLOCKERS.md / compliance/risk-acceptance-log.md).
const REAL_FIXTURE = {
  jobId: '7p2uv',
  jobUrl: 'https://www.104.com.tw/job/7p2uv',
  jobName: 'SAP ERP顧問',
  company: '台灣顧雲股份有限公司',
  area: '台北市中正區',
  shortDescription: 'Hi 為您介紹SAP是誰呢? SAP 是全球最大的ERP 系統公司',
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('fetchTw104Postings', () => {
  it('maps a real Apify actor response into a NormalisedPosting for the TW market', async () => {
    global.fetch = (async () => new Response(JSON.stringify([REAL_FIXTURE]), { status: 201 })) as typeof fetch;

    const postings = [];
    for await (const posting of fetchTw104Postings(['SAP'])) postings.push(posting);

    expect(postings).toEqual([
      {
        sourceProvider: 'tw104',
        externalRef: '7p2uv',
        employerApplyUrl: 'https://www.104.com.tw/job/7p2uv',
        title: 'SAP ERP顧問',
        employer: '台灣顧雲股份有限公司',
        requirementsSummary: '台北市中正區',
        language: 'zh_Hant',
        market: 'TW',
      },
    ]);
  });

  it('queries the actor once per seed keyword, without fetching full descriptions', async () => {
    const bodies: unknown[] = [];
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(init!.body as string));
      return new Response(JSON.stringify([]), { status: 201 });
    }) as typeof fetch;

    const postings = [];
    for await (const posting of fetchTw104Postings(['軟體工程師', '行銷'])) postings.push(posting);

    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ keyword: '軟體工程師', includeFullDescription: false });
    expect(bodies[1]).toMatchObject({ keyword: '行銷', includeFullDescription: false });
  });

  it('detects an English posting on a bilingual board, not just Chinese', async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify([
          {
            ...REAL_FIXTURE,
            jobId: 'en-1',
            jobName: 'Senior Backend Engineer',
            shortDescription: 'We are looking for an experienced backend engineer to join our team.',
          },
        ]),
        { status: 201 },
      )) as typeof fetch;

    const postings = [];
    for await (const posting of fetchTw104Postings(['backend engineer'])) postings.push(posting);

    expect(postings[0].language).toBe('en');
  });
});
