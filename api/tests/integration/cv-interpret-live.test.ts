import { config } from '../../src/config/index.js';
import { createOpenAiCompatibleClient } from '../../src/llm/client.js';
import { interpretCv } from '../../src/cv/interpret.js';
import { skippingProviderCapacity } from '../helpers/live-llm.js';

// Real network call against the configured LLM provider (OpenRouter,
// nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free for dev — see
// .env.example). Skips itself when no key is configured, so `npm test`
// still passes in an environment without one; this is the one place that
// proves the whole chain (prompt → real model → parse) works end to end,
// not just its pieces in isolation. Requires `npm test` specifically
// (not a bare `jest` invocation) — see scripts/preload-env.mjs for why.
const hasLiveKey = Boolean(config.openaiApiKey && config.openaiBaseUrl && config.llmModel);
const maybeIt = hasLiveKey ? it : it.skip;


const EN_CV = `
Jane Doe
Senior Backend Engineer

5 years of experience building distributed systems in TypeScript and Go.
Led a team of 4 engineers at Acme Corp; designed and operated PostgreSQL-backed
services handling 10k requests/sec.

Skills: TypeScript, Go, PostgreSQL, Kubernetes, AWS
`;

const ZH_HANT_CV = `
王小明
資深後端工程師

工作經驗
五年以上軟體工程經驗，專長為後端系統開發與資料庫設計。
曾於新創公司帶領三人團隊，負責建置高流量的應用程式介面。

技能
Node.js、TypeScript、PostgreSQL、雲端架構
`;

describe('interpretCv — live LLM integration', () => {
  maybeIt(
    'extracts real keywords and YoE from an English CV via the configured model',
    async () => {
      await skippingProviderCapacity(async () => {
        const llm = createOpenAiCompatibleClient({
          apiKey: config.openaiApiKey,
          baseUrl: config.openaiBaseUrl,
          model: config.llmModel,
        });

        const result = await interpretCv(EN_CV, 'en', llm);

        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.yoe).toBe(5); // regex extractor should win regardless of model output
        const lower = result.keywords.map((k) => k.toLowerCase());
        expect(lower.some((k) => k.includes('typescript') || k.includes('postgres') || k.includes('go'))).toBe(
          true,
        );
      });
    },
    240_000, // reasoning model, plus client.ts's retries when the free tier is at capacity
  );

  maybeIt(
    'extracts non-empty keywords from a real Traditional Chinese CV (SDD R5, end to end)',
    async () => {
      await skippingProviderCapacity(async () => {
        const llm = createOpenAiCompatibleClient({
          apiKey: config.openaiApiKey,
          baseUrl: config.openaiBaseUrl,
          model: config.llmModel,
        });

        const result = await interpretCv(ZH_HANT_CV, 'zh_Hant', llm);

        expect(result.keywords.length).toBeGreaterThan(0);
        expect(result.yoe).toBe(5);
      });
    },
    240_000,
  );
});
