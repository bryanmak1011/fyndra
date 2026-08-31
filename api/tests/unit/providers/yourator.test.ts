import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchYouratorPostings } from '../../../src/sourcing/providers/yourator.js';

// Fixture is a recorded (and lightly augmented — see the "Test Job With
// Third Party URL" entry) real response from GET
// https://www.yourator.co/api/v4/jobs?page=1, so this test exercises the
// provider's actual parsing logic without depending on network access or
// Yourator's current listings.
const fixturePath = fileURLToPath(new URL('./fixtures/yourator-page1.json', import.meta.url));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));

describe('Yourator provider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('normalises real Yourator postings and enforces the host allowlist', async () => {
    let capturedUrl: string | undefined;
    global.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fixture), { status: 200 });
    }) as typeof fetch;

    const postings = [];
    for await (const posting of fetchYouratorPostings()) postings.push(posting);

    expect(capturedUrl).toBe('https://www.yourator.co/api/v4/jobs?page=1');
    expect(postings).toHaveLength(4);

    const [first] = postings;
    expect(first.sourceProvider).toBe('yourator');
    expect(first.market).toBe('TW');
    // No thirdPartyUrl on this job → falls back to the Yourator posting page.
    expect(first.employerApplyUrl).toBe('https://www.yourator.co/companies/aifian/jobs/23193');
    expect(first.language).toBe('en'); // title "Sr. Software Engineer" has no CJK characters
  });

  it('prefers the employer ATS URL and strips utm_* params when present', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify(fixture), { status: 200 })) as typeof fetch;

    const postings = [];
    for await (const posting of fetchYouratorPostings()) postings.push(posting);

    const synthetic = postings.find((p) => p.externalRef === '999999');
    expect(synthetic?.employerApplyUrl).toBe('https://boards.greenhouse.io/testco/jobs/123');
  });

  it('stops paging when the source reports no more results', async () => {
    let fetchCount = 0;
    global.fetch = (async () => {
      fetchCount++;
      return new Response(JSON.stringify(fixture), { status: 200 }); // hasMore: false
    }) as typeof fetch;

    const postings = [];
    for await (const posting of fetchYouratorPostings()) postings.push(posting);

    expect(fetchCount).toBe(1);
  });
});
