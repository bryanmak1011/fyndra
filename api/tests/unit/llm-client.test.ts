import { createOpenAiCompatibleClient, isTransientLlmError, LlmResponseError } from '../../src/llm/client.js';

// maxAttempts: 1 for the single-shot assertions below — they assert what one
// call does, and letting them retry would only make them slower and vaguer.
// The retry behaviour itself has its own tests at the bottom of the file.
const config = {
  apiKey: 'test-key',
  baseUrl: 'https://example.test/api',
  model: 'test-model',
  maxAttempts: 1,
};

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

  it('sends response_format when a caller supplies a JSON schema, and omits it otherwise', async () => {
    let capturedBody: Record<string, unknown> = {};
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init!.body as string);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 });
    }) as typeof fetch;

    const client = createOpenAiCompatibleClient(config);
    const schema = { name: 'thing', schema: { type: 'object', properties: {} } };
    await client.complete('a prompt', { jsonSchema: schema });

    expect(capturedBody.response_format).toEqual({
      type: 'json_schema',
      json_schema: { ...schema, strict: true },
    });

    await client.complete('a prompt');
    expect(capturedBody).not.toHaveProperty('response_format');
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

// The free-tier dev model returns HTTP 200 with a ResourceExhausted payload
// whenever several Jest workers hit the shared pool at once — it took down
// two integration tests per full run before this existed. Retrying is also
// the right production behaviour: a user's CV parse should not fail because
// the provider was briefly at capacity.
describe('createOpenAiCompatibleClient — transient-failure retries', () => {
  const retrying = { ...config, maxAttempts: 3, retryBaseDelayMs: 1 };

  it('retries an HTTP-200 ResourceExhausted payload and succeeds on a later attempt', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      if (calls < 3) {
        return new Response(
          JSON.stringify({
            error: { message: 'Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (20/16)', code: 502 },
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: 'recovered' } }] }), { status: 200 });
    }) as typeof fetch;

    await expect(createOpenAiCompatibleClient(retrying).complete('x')).resolves.toBe('recovered');
    expect(calls).toBe(3);
  });

  it('retries a 429 and a 503', async () => {
    for (const status of [429, 503]) {
      let calls = 0;
      global.fetch = (async () => {
        calls++;
        return calls === 1
          ? new Response('busy', { status })
          : new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 });
      }) as typeof fetch;

      await expect(createOpenAiCompatibleClient(retrying).complete('x')).resolves.toBe('ok');
      expect(calls).toBe(2);
    }
  });

  it('does NOT retry a 400 — a malformed request will fail identically every time', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return new Response('bad model', { status: 400 });
    }) as typeof fetch;

    await expect(createOpenAiCompatibleClient(retrying).complete('x')).rejects.toBeInstanceOf(LlmResponseError);
    expect(calls).toBe(1);
  });

  it('does NOT retry a well-formed 200 whose content is simply missing', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ choices: [] }), { status: 200 });
    }) as typeof fetch;

    await expect(createOpenAiCompatibleClient(retrying).complete('x')).rejects.toBeInstanceOf(LlmResponseError);
    expect(calls).toBe(1);
  });

  it('labels a capacity failure transient and a bad request not', async () => {
    global.fetch = (async () => new Response('bad model', { status: 400 })) as typeof fetch;
    const badRequest = await createOpenAiCompatibleClient(config).complete('x').catch((e) => e);
    expect(isTransientLlmError(badRequest)).toBe(false);

    global.fetch = (async () => new Response('busy', { status: 429 })) as typeof fetch;
    const atCapacity = await createOpenAiCompatibleClient(config).complete('x').catch((e) => e);
    expect(isTransientLlmError(atCapacity)).toBe(true);

    expect(isTransientLlmError(new Error('something else'))).toBe(false);
  });

  it('gives up after maxAttempts and surfaces the last error', async () => {
    let calls = 0;
    global.fetch = (async () => {
      calls++;
      return new Response('still busy', { status: 429 });
    }) as typeof fetch;

    await expect(createOpenAiCompatibleClient(retrying).complete('x')).rejects.toThrow(/429/);
    expect(calls).toBe(3);
  });
});
