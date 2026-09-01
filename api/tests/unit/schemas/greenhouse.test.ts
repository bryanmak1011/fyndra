import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  fetchGreenhouseFormSchema,
  extractGreenhouseJobId,
} from '../../../src/apply/schemas/greenhouse.js';

// Recorded from a real GET against
// boards-api.greenhouse.io/v1/boards/gitlab/jobs/{id}?questions=true —
// trimmed to 4 representative real questions, including the exact
// sponsorship question sensitive.ts must classify.
function fixture(): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL('../fixtures/greenhouse-job-detail.json', import.meta.url)), 'utf8'),
  );
}

describe('fetchGreenhouseFormSchema', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('enforces the host allowlist and returns real form questions', async () => {
    let capturedUrl: string | undefined;
    global.fetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(JSON.stringify(fixture()), { status: 200 });
    }) as typeof fetch;

    const questions = await fetchGreenhouseFormSchema('gitlab', '8503792002');

    expect(capturedUrl).toBe(
      'https://boards-api.greenhouse.io/v1/boards/gitlab/jobs/8503792002?questions=true',
    );
    expect(questions).toHaveLength(4);
  });

  it('preserves select-field option values exactly (needed for correct submission)', async () => {
    global.fetch = (async () => new Response(JSON.stringify(fixture()), { status: 200 })) as typeof fetch;

    const questions = await fetchGreenhouseFormSchema('gitlab', '8503792002');
    const sponsorship = questions.find((q) => q.label.toLowerCase().includes('sponsorship'));

    expect(sponsorship).toBeDefined();
    expect(sponsorship!.required).toBe(true);
    expect(sponsorship!.fields[0].type).toBe('multi_value_single_select');
    expect(sponsorship!.fields[0].values.length).toBeGreaterThan(0);
    expect(sponsorship!.fields[0].values[0]).toEqual({ label: 'No', value: 239207523002 });
  });
});

describe('extractGreenhouseJobId', () => {
  it('extracts the numeric job id from a real absolute_url', () => {
    expect(extractGreenhouseJobId('https://job-boards.greenhouse.io/gitlab/jobs/8503792002')).toBe(
      '8503792002',
    );
  });

  it('returns null for a URL with no job id segment', () => {
    expect(extractGreenhouseJobId('https://job-boards.greenhouse.io/gitlab')).toBeNull();
  });
});
