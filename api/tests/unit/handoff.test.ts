import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prepareHandoff } from '../../src/apply/handoff.js';
import type { LlmClient } from '../../src/llm/client.js';

function fixture(): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL('./fixtures/greenhouse-job-detail.json', import.meta.url)), 'utf8'),
  );
}

const profile = { id: 'p1', email: 'candidate@example.com', yoe: 5, keywords: ['TypeScript'] };
const fakeLlm: LlmClient = { complete: async () => 'UNKNOWN' };

describe('prepareHandoff', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns an empty sheet when there is no employer apply URL', async () => {
    const result = await prepareHandoff({ sourceProvider: 'yourator', employerApplyUrl: null }, profile, fakeLlm);
    expect(result).toEqual({ proposedAnswers: [], pendingQuestions: [] });
  });

  it('returns an empty sheet for a provider with no known form-schema reader', async () => {
    const result = await prepareHandoff(
      { sourceProvider: 'yourator', employerApplyUrl: 'https://www.yourator.co/companies/x/jobs/1' },
      profile,
      fakeLlm,
    );
    expect(result).toEqual({ proposedAnswers: [], pendingQuestions: [] });
  });

  it('returns an empty sheet for a Lever/Ashby/Workable posting even with a URL present', async () => {
    const result = await prepareHandoff(
      { sourceProvider: 'lever', employerApplyUrl: 'https://jobs.lever.co/testco/abc-123' },
      profile,
      fakeLlm,
    );
    expect(result).toEqual({ proposedAnswers: [], pendingQuestions: [] });
  });

  it('fetches the real Greenhouse schema and runs prefill for a Greenhouse posting', async () => {
    let capturedUrl: string | undefined;
    global.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fixture()), { status: 200 });
    }) as typeof fetch;

    const result = await prepareHandoff(
      { sourceProvider: 'greenhouse', employerApplyUrl: 'https://job-boards.greenhouse.io/gitlab/jobs/8503792002' },
      profile,
      fakeLlm,
    );

    expect(capturedUrl).toBe(
      'https://boards-api.greenhouse.io/v1/boards/gitlab/jobs/8503792002?questions=true',
    );
    // The fixture's sponsorship question must land in pendingQuestions,
    // never auto-answered by the fake LLM.
    expect(
      result.pendingQuestions.some((q) => q.questionText.toLowerCase().includes('sponsorship')),
    ).toBe(true);
  });

  it('returns an empty sheet when the employer URL does not match the expected Greenhouse shape', async () => {
    const result = await prepareHandoff(
      { sourceProvider: 'greenhouse', employerApplyUrl: 'https://job-boards.greenhouse.io/gitlab' }, // no /jobs/{id}
      profile,
      fakeLlm,
    );
    expect(result).toEqual({ proposedAnswers: [], pendingQuestions: [] });
  });
});
