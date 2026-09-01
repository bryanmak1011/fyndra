import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { retrieveCv } from '../cv/storage.js';
import { extractText } from '../cv/extract.js';
import { detectLanguage } from '../matching/segment.js';
import { interpretCv } from '../cv/interpret.js';
import { createOpenAiCompatibleClient } from '../llm/client.js';
import { config } from '../config/index.js';
import { registerHandler } from './index.js';
import { logger } from '../lib/logger.js';

const payloadSchema = z.object({ cvDocumentId: z.string().uuid() });

/**
 * The asynchronous half of CV intake (T034). Format validation already
 * happened synchronously at upload (routes/profile.ts, extract.ts) — this
 * handler re-extracts the same deterministic text (cheap, no reason to
 * persist plaintext CV content in Postgres separately from the encrypted
 * original) and runs the LLM semantic mapping step.
 */
export async function handleParseCv(payload: Prisma.JsonValue): Promise<void> {
  const { cvDocumentId } = payloadSchema.parse(payload);
  const doc = await prisma.cvDocument.findUniqueOrThrow({ where: { id: cvDocumentId } });

  try {
    const fileBuf = await retrieveCv(doc.storageRef);
    const { text } = await extractText(fileBuf);
    const language = detectLanguage(text);

    const llm = createOpenAiCompatibleClient({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      model: config.llmModel,
    });
    const { keywords, yoe } = await interpretCv(text, language, llm);

    await prisma.cvDocument.update({
      where: { id: cvDocumentId },
      data: {
        rawExtractedKeywords: keywords,
        rawExtractedYoe: yoe,
        detectedLanguage: language,
        languageSegmenter: language === 'en' ? 'whitespace' : 'cjk',
        parseStatus: 'succeeded',
      },
    });
  } catch (err) {
    logger.error('parse_cv_failed', { cvDocumentId, error: err instanceof Error ? err.message : String(err) });
    await prisma.cvDocument.update({ where: { id: cvDocumentId }, data: { parseStatus: 'failed' } });
    throw err; // re-throw so the queue's own retry/attempt bookkeeping applies
  }
}

export function registerParseCvHandler(): void {
  registerHandler('parse_cv', handleParseCv);
}
