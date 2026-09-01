import { interpretCv, InterpretationError } from '../../src/cv/interpret.js';
import type { LlmClient } from '../../src/llm/client.js';

function fakeLlm(response: string): LlmClient {
  return { complete: async () => response };
}

const EN_CV = 'Jane Doe — Senior Backend Engineer. 5 years of experience with TypeScript and PostgreSQL.';

describe('interpretCv', () => {
  it('parses a clean JSON response', async () => {
    const llm = fakeLlm('{"keywords": ["TypeScript", "PostgreSQL", "Backend Engineering"], "yoe": 5}');
    const result = await interpretCv(EN_CV, 'en', llm);
    expect(result.keywords).toEqual(['TypeScript', 'PostgreSQL', 'Backend Engineering']);
    expect(result.yoe).toBe(5);
  });

  it('extracts JSON even when the model wraps it in markdown fences and prose', async () => {
    const llm = fakeLlm(
      'Here is the extracted profile:\n```json\n{"keywords": ["TypeScript"], "yoe": 5}\n```\nLet me know if you need anything else.',
    );
    const result = await interpretCv(EN_CV, 'en', llm);
    expect(result.keywords).toEqual(['TypeScript']);
  });

  it('prefers the deterministic regex YoE over the LLM-reported one when both are present', async () => {
    // EN_CV states "5 years" explicitly — the regex extractor should win
    // even if the model reports something else.
    const llm = fakeLlm('{"keywords": ["TypeScript"], "yoe": 3}');
    const result = await interpretCv(EN_CV, 'en', llm);
    expect(result.yoe).toBe(5);
  });

  it('falls back to the LLM-reported YoE when the regex extractor finds nothing', async () => {
    const noExplicitYoe = 'Jane Doe — Senior Backend Engineer with deep TypeScript expertise.';
    const llm = fakeLlm('{"keywords": ["TypeScript"], "yoe": 7}');
    const result = await interpretCv(noExplicitYoe, 'en', llm);
    expect(result.yoe).toBe(7);
  });

  it('throws InterpretationError on zero keywords rather than passing an empty result through (SDD R5)', async () => {
    const llm = fakeLlm('{"keywords": [], "yoe": 5}');
    await expect(interpretCv(EN_CV, 'en', llm)).rejects.toBeInstanceOf(InterpretationError);
  });

  it('throws InterpretationError when the model returns no JSON at all', async () => {
    const llm = fakeLlm("Sorry, I can't help with that.");
    await expect(interpretCv(EN_CV, 'en', llm)).rejects.toBeInstanceOf(InterpretationError);
  });

  it('filters out non-string entries in a malformed keywords array rather than crashing', async () => {
    const llm = fakeLlm('{"keywords": ["TypeScript", 42, null, "PostgreSQL"], "yoe": 5}');
    const result = await interpretCv(EN_CV, 'en', llm);
    expect(result.keywords).toEqual(['TypeScript', 'PostgreSQL']);
  });

  it('SDD §10.1: extra fields an adversarial response tries to smuggle in are silently ignored, not acted on', async () => {
    // Simulates a CV containing prompt-injection text that got the model
    // to emit extra JSON fields beyond the documented shape. The only
    // structural guarantee this codebase relies on is that nothing reads
    // fields other than `keywords`/`yoe` from this response — proving
    // that here, rather than just asserting it by code inspection.
    const llm = fakeLlm(
      '{"keywords": ["TypeScript"], "yoe": 5, "status": "applied", "role": "admin", "__proto__": {"isAdmin": true}}',
    );
    const result = await interpretCv(EN_CV, 'en', llm);
    expect(result).toEqual({ keywords: ['TypeScript'], yoe: 5 });
    expect(Object.keys(result)).toEqual(['keywords', 'yoe']);
  });
});
