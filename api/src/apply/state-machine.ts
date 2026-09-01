import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { prepareHandoff } from './handoff.js';
import { fingerprintQuestion } from './answer-reuse.js';
import { createOpenAiCompatibleClient } from '../llm/client.js';
import { config } from '../config/index.js';
import { registerHandler } from '../queue/index.js';
import { logger } from '../lib/logger.js';

const payloadSchema = z.object({ applicationId: z.string().uuid() });

/**
 * Processes a `queued` Application: runs prefill (currently always via
 * handoff.ts — see apply-route.ts's 2026-09-01 note, direct submission
 * has no real channel for any provider right now) and lands it on
 * `pending_needs_answer` (unanswerable/sensitive questions exist) or
 * `awaiting_review` (ready for the user to review and confirm). Never
 * lands directly on `applied` or `handed_off` — those only happen via
 * the user's own confirm/handoff-complete action (routes/applications.ts).
 */
export async function handleSubmit(payload: Prisma.JsonValue): Promise<void> {
  const { applicationId } = payloadSchema.parse(payload);

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { jobInteraction: { include: { jobPosting: true, profile: true } } },
  });

  const posting = application.jobInteraction.jobPosting;
  const profile = application.jobInteraction.profile;

  try {
    const llm = createOpenAiCompatibleClient({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      model: config.llmModel,
    });

    const result = await prepareHandoff(
      { sourceProvider: posting.sourceProvider, employerApplyUrl: posting.employerApplyUrl },
      { id: profile.id, email: profile.email, yoe: profile.yoe, keywords: profile.keywords },
      llm,
    );

    await prisma.$transaction(async (tx) => {
      for (const answer of result.proposedAnswers) {
        await tx.proposedAnswer.create({
          data: {
            applicationId,
            fieldId: answer.fieldId,
            label: answer.label,
            answer: answer.answer,
            source: answer.source,
          },
        });
      }
      for (const pending of result.pendingQuestions) {
        await tx.applicationQuestion.create({
          data: {
            applicationId,
            profileId: profile.id,
            questionText: pending.questionText,
            questionFingerprint: fingerprintQuestion(pending.questionText),
            isSensitive: pending.isSensitive,
          },
        });
      }

      const nextStatus = result.pendingQuestions.length > 0 ? 'pending_needs_answer' : 'awaiting_review';
      await tx.application.update({ where: { id: applicationId }, data: { status: nextStatus } });
      await tx.applicationStatusEvent.create({ data: { applicationId, status: nextStatus } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('submit_failed', { applicationId, error: message });
    await prisma.$transaction([
      prisma.application.update({
        where: { id: applicationId },
        data: { status: 'needs_attention', failureReason: 'site_error' },
      }),
      prisma.applicationStatusEvent.create({
        data: { applicationId, status: 'needs_attention', note: message.slice(0, 500) },
      }),
    ]);
    throw err;
  }
}

export function registerSubmitHandler(): void {
  registerHandler('submit', handleSubmit);
}
