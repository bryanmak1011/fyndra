// Direct SDK/HTTP calls, not a spawned agent CLI — see research.md "Where
// the intelligence comes from". Any OpenAI-compatible endpoint works
// (OpenRouter, OpenAI itself, a local vLLM/Ollama), selected by base URL.
export interface LlmClient {
  complete(prompt: string): Promise<string>;
}

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message: { content: string | null } }>;
  error?: { message?: string; code?: string | number };
}

export class LlmResponseError extends Error {}

export function createOpenAiCompatibleClient(config: LlmConfig): LlmClient {
  return {
    async complete(prompt: string): Promise<string> {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const rawText = await response.text();

      if (!response.ok) {
        throw new LlmResponseError(`LLM request failed: ${response.status} ${rawText}`);
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
        throw new LlmResponseError(`LLM provider error (HTTP 200): ${JSON.stringify(body.error)}`);
      }
      const content = body.choices?.[0]?.message.content;
      if (!content) {
        throw new LlmResponseError(`LLM response had no usable content: ${rawText.slice(0, 500)}`);
      }
      return content;
    },
  };
}
