import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchGreenhousePostings } from '../../../src/sourcing/providers/ats/greenhouse.js';
import { fetchLeverPostings } from '../../../src/sourcing/providers/ats/lever.js';
import { fetchAshbyPostings } from '../../../src/sourcing/providers/ats/ashby.js';
import { fetchWorkablePostings } from '../../../src/sourcing/providers/ats/workable.js';

// Every fixture here is a recorded real response (GitLab/Greenhouse, TRI/Lever,
// Ramp/Ashby, Suade/Workable), each with one synthetic HK/TW entry appended
// (same technique as providers/yourator.test.ts) so both the "skip"
// (real, non-HK/TW postings) and "keep" (HK/TW) paths run against real
// schema shapes rather than an invented one.
function fixture(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8'));
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

describe('Greenhouse provider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('enforces the host allowlist and filters to HK/TW only', async () => {
    let capturedUrl: string | undefined;
    global.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fixture('greenhouse-gitlab.json')), { status: 200 });
    }) as typeof fetch;

    const postings = await collect(fetchGreenhousePostings('gitlab'));

    expect(capturedUrl).toBe('https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=false');
    expect(postings).toHaveLength(1); // the 2 real GitLab jobs are non-HK/TW and skipped
    expect(postings[0].sourceProvider).toBe('greenhouse');
    expect(postings[0].market).toBe('HK');
    expect(postings[0].title).toContain('HK');
  });
});

describe('Lever provider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('filters to HK/TW using the structured country field', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify(fixture('lever-tri.json')), { status: 200 })) as typeof fetch;

    const postings = await collect(fetchLeverPostings('tri'));

    expect(postings).toHaveLength(1);
    expect(postings[0].sourceProvider).toBe('lever');
    expect(postings[0].market).toBe('TW');
  });
});

describe('Ashby provider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('filters to HK/TW using free-text address fields', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify(fixture('ashby-ramp.json')), { status: 200 })) as typeof fetch;

    const postings = await collect(fetchAshbyPostings('Ramp'));

    expect(postings).toHaveLength(1);
    expect(postings[0].sourceProvider).toBe('ashby');
    expect(postings[0].market).toBe('HK');
  });
});

describe('Workable provider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('filters to HK/TW using the structured countryCode field', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify(fixture('workable-suade.json')), { status: 200 })) as typeof fetch;

    const postings = await collect(fetchWorkablePostings('suade'));

    expect(postings).toHaveLength(1);
    expect(postings[0].sourceProvider).toBe('workable');
    expect(postings[0].market).toBe('HK');
  });
});
