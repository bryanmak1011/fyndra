// Direct SDK/HTTP calls, not a spawned agent CLI — see research.md "Where
// the intelligence comes from". Any OpenAI-compatible endpoint works
// (OpenRouter, OpenAI itself, a local vLLM/Ollama), selected by base URL.
export interface LlmClient {
  complete(prompt: string, options?: CompleteOptions): Promise<string>;
}

export interface CompleteOptions {
  /**
   * A JSON Schema the provider constrains the response to, sent as the
   * OpenAI-compatible `response_format: {type: 'json_schema', strict: true}`.
   *
   * This replaces telling the model "reply with ONLY JSON, no fences" in
   * prose — an instruction that demonstrably does not hold (see
   * tests/unit/cv-interpret.test.ts's fenced-output case). It is a hint, not
   * a guarantee: OpenRouter free-tier models vary in whether they honour
   * `response_format`, and a provider that ignores it returns exactly what
   * it returned before. Callers therefore keep their defensive parse.
   */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  /** Total attempts including the first. 1 disables retrying. */
  maxAttempts?: number;
  /** First backoff delay; each further attempt doubles it. */
  retryBaseDelayMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message: { content: string | null } }>;
  error?: { message?: string; code?: string | number };
}

export class LlmResponseError extends Error {
  /**
   * True when the failure is the provider being momentarily unable to serve
   * us — a capacity/rate limit or an upstream hiccup — rather than anything
   * wrong with the request. Only these are worth retrying.
   */
  readonly transient: boolean;

  constructor(message: string, transient = false) {
    super(message);
    this.transient = transient;
  }
}

const TRANSIENT_PROVIDER_SIGNALS = [
  'resourceexhausted',
  'resource exhausted',
  'rate limit',
  'rate-limit',
  'ratelimit',
  'too many requests',
  'provider_unavailable',
  'temporarily unavailable',
  'overloaded',
  'timeout',
];

function looksTransient(payload: string): boolean {
  const lowered = payload.toLowerCase();
  return TRANSIENT_PROVIDER_SIGNALS.some((signal) => lowered.includes(signal));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when a failure is the provider being momentarily unable to serve us
 * rather than anything wrong with the request. Exported so a caller — and
 * in particular the live integration tests — can tell "the vendor is at
 * capacity" apart from "our prompt or parsing is broken".
 */
export function isTransientLlmError(error: unknown): boolean {
  return error instanceof LlmResponseError && error.transient;
}

export function createOpenAiCompatibleClient(config: LlmConfig): LlmClient {
  // Five attempts at a 2s base means ~30s of waiting before giving up. The
  // dev model runs on a shared free-tier pool whose concurrency limit is
  // reached by *other people's* traffic, not just ours, and a single
  // in-flight request there can take 30-90s — a 3×500ms budget retried
  // entirely inside one other caller's request and always lost.
  const maxAttempts = Math.max(1, config.maxAttempts ?? 5);
  const baseDelay = config.retryBaseDelayMs ?? 2_000;

  async function attempt(prompt: string, options?: CompleteOptions): Promise<string> {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        ...(options?.jsonSchema
          ? {
              response_format: {
                type: 'json_schema',
                json_schema: { ...options.jsonSchema, strict: true },
              },
            }
          : {}),
      }),
    });

    const rawText = await response.text();

    if (!response.ok) {
      // 429 and 5xx are the provider's problem and may clear on their own;
      // a 4xx other than 429 means the request itself is wrong and retrying
      // it just burns quota.
      const transient = response.status === 429 || response.status >= 500;
      throw new LlmResponseError(`LLM request failed: ${response.status} ${rawText}`, transient);
    }

    let body: ChatCompletionResponse;
    try {
      body = JSON.parse(rawText);
    } catch {
      throw new LlmResponseError(`LLM response was not valid JSON: ${rawText.slice(0, 500)}`);
    }

    // Some providers (confirmed with OpenRouter under load) return HTTP
    // 200 with an error payload instead of `choices` — e.g. an
    // upstream-provider hiccup on a free-tier model. Surface that
    // clearly rather than crashing on `.choices[0]` of undefined.
    if (body.error) {
      const payload = JSON.stringify(body.error);
      throw new LlmResponseError(`LLM provider error (HTTP 200): ${payload}`, looksTransient(payload));
    }
    const content = body.choices?.[0]?.message.content;
    if (!content) {
      throw new LlmResponseError(`LLM response had no usable content: ${rawText.slice(0, 500)}`);
    }
    return content;
  }

  return {
    async complete(prompt: string, options?: CompleteOptions): Promise<string> {
      let lastError: unknown;
      for (let n = 1; n <= maxAttempts; n++) {
        try {
          return await attempt(prompt, options);
        } catch (error) {
          lastError = error;
          // A transport-level throw (socket reset, DNS blip) is transient by
          // nature; anything else is only retried when it said so.
          const transient = error instanceof LlmResponseError ? error.transient : true;
          if (!transient || n === maxAttempts) throw error;
          await sleep(baseDelay * 2 ** (n - 1));
        }
      }
      throw lastError;
    },
  };
}
