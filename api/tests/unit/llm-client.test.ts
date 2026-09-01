import { createOpenAiCompatibleClient, LlmResponseError } from '../../src/llm/client.js';

const config = { apiKey: 'test-key', baseUrl: 'https://example.test/api', model: 'test-model' };

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

describe('createOpenAiCompatibleClient', () => {
  it('sends the expected request shape and returns the message content', async () => {
    let capturedUrl: string | undefined;
    let capturedBody: unknown;
    let capturedAuth: string | null = null;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(init!.body as string);
      capturedAuth = (init!.headers as Record<string, string>).Authorization;
      return new Response(JSON.stringify({ choices: [{ message: { content: 'hello' } }] }), { status: 200 });
    }) as typeof fetch;

    const client = createOpenAiCompatibleClient(config);
    const result = await client.complete('a prompt');

    expect(result).toBe('hello');
    expect(capturedUrl).toBe('https://example.test/api/chat/completions');
    expect(capturedAuth).toBe('Bearer test-key');
    expect(capturedBody).toEqual({
      model: 'test-model',
      messages: [{ role: 'user', content: 'a prompt' }],
    });
  });

  it('throws LlmResponseError on a non-2xx HTTP response', async () => {
    global.fetch = (async () => new Response('rate limited', { status: 429 })) as typeof fetch;
    const client = createOpenAiCompatibleClient(config);
    await expect(client.complete('x')).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('throws LlmResponseError when the 200 response body is not valid JSON', async () => {
    global.fetch = (async () => new Response('not json at all', { status: 200 })) as typeof fetch;
    const client = createOpenAiCompatibleClient(config);
    await expect(client.complete('x')).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('throws LlmResponseError on an HTTP-200 error payload (confirmed real OpenRouter behavior under load)', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ error: { message: 'resource exhausted', code: 502 } }), {
        status: 200,
      })) as typeof fetch;
    const client = createOpenAiCompatibleClient(config);
    await expect(client.complete('x')).rejects.toThrow(/resource exhausted/);
  });

  it('throws LlmResponseError when choices is missing entirely, rather than crashing', async () => {
    global.fetch = (async () => new Response(JSON.stringify({}), { status: 200 })) as typeof fetch;
    const client = createOpenAiCompatibleClient(config);
    await expect(client.complete('x')).rejects.toBeInstanceOf(LlmResponseError);
  });

  it('throws LlmResponseError when the message content is null', async () => {
    global.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), {
        status: 200,
      })) as typeof fetch;
    const client = createOpenAiCompatibleClient(config);
    await expect(client.complete('x')).rejects.toBeInstanceOf(LlmResponseError);
  });
});
