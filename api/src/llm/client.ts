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
  choices: Array<{ message: { content: string | null } }>;
}

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

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
      }

      const body = (await response.json()) as ChatCompletionResponse;
      const content = body.choices[0]?.message.content;
      if (!content) throw new Error('LLM response had no content');
      return content;
    },
  };
}
