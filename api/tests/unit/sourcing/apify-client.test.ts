import { createApifyClient, ApifyRunError } from '../../../src/sourcing/apify-client.js';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('createApifyClient', () => {
  it('POSTs to the run-sync-get-dataset-items endpoint with bearer auth and returns the dataset items', async () => {
    let capturedUrl: string | undefined;
    let capturedAuth: string | null = null;
    let capturedBody: unknown;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedAuth = (init!.headers as Record<string, string>).Authorization;
      capturedBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify([{ id: 1 }, { id: 2 }]), { status: 201 });
    }) as typeof fetch;

    const client = createApifyClient({ apiToken: 'test-token' });
    const items = await client.runActorSync('someone~some-actor', { keyword: 'engineer' });

    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
    expect(capturedUrl).toBe('https://api.apify.com/v2/acts/someone~some-actor/run-sync-get-dataset-items');
    expect(capturedAuth).toBe('Bearer test-token');
    expect(capturedBody).toEqual({ keyword: 'engineer' });
  });

  it('throws ApifyRunError with the actor id and status when the run fails (real observed shape: HTTP 400 with a run-failed error body)', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ error: { type: 'run-failed', message: 'Actor run did not succeed' } }), {
        status: 400,
      })) as typeof fetch;

    const client = createApifyClient({ apiToken: 'test-token' });
    await expect(client.runActorSync('someone~broken-actor', {})).rejects.toThrow(ApifyRunError);
    await expect(client.runActorSync('someone~broken-actor', {})).rejects.toThrow(/someone~broken-actor/);
  });
});
