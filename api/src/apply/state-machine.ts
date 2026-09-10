import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { prepareHandoff } from './handoff.js';
import { fingerprintQuestion } from './answer-reuse.js';
import { createOpenAiCompatibleClient } from '../llm/client.js';
import { config } from '../config/index.js';
import { registerHandler } from '../queue/index.js';
import { logger } from '../lib/logger.js';
import { attemptBrowserSubmit } from '../browser-agent/index.js';

const payloadSchema = z.object({ applicationId: z.string().uuid() });

/**
 * Processes a `queued` Application. Two paths, chosen by
 * `application.applyRoute` (set per-application at swipe time — see
 * sourcing/apply-route.ts's resolveApplyRoute):
 *
 * - `browser_automated`: delegates to browser-agent/index.ts, which drives
 *   a real browser click and — on success — lands the Application on
 *   `auto_submitted` itself (system-attested, evidence-backed). See that
 *   module for its own failure handling; this function's catch block below
 *   is not reached on that path except for errors thrown before dispatch.
 * - everything else (today, always `handoff`): runs prefill via
 *   handoff.ts and lands on `pending_needs_answer` (unanswerable/sensitive
 *   questions exist) or `awaiting_review` (ready for the user to review
 *   and confirm). Never lands directly on `applied` or `handed_off` —
 *   those only happen via the user's own confirm/handoff-complete action
 *   (routes/applications.ts).
 */
export async function handleSubmit(payload: Prisma.JsonValue): Promise<void> {
  const { applicationId } = payloadSchema.parse(payload);

  const application = await prisma.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { jobInteraction: { include: { jobPosting: true, profile: true } } },
  });

  const posting = application.jobInteraction.jobPosting;
  const profile = application.jobInteraction.profile;

  if (application.applyRoute === 'browser_automated') {
    try {
      await attemptBrowserSubmit({
        applicationId,
        profileId: profile.id,
        sourceProvider: posting.sourceProvider,
        employerApplyUrl: posting.employerApplyUrl,
        // No form-schema reader exists yet for jobsdb-hk/tw104 (unlike
        // Greenhouse's prefill.ts), so there are no proposed answers to
        // pass through today — the provider drives whatever the native
        // apply flow presents. Revisit once a provider needs structured
        // answers.
        answers: [],
      });
    } catch (err) {
      // attemptBrowserSubmit already routes every failure it can reach a
      // SubmissionAttempt for into needs_attention itself; this only
      // catches the guard-clause throws before that point (e.g. gating
      // somehow disagreed with resolveApplyRoute's earlier decision) so
      // the Application never stays stuck at `queued`.
      const message = err instanceof Error ? err.message : String(err);
      logger.error('browser_submit_guard_failed', { applicationId, error: message });
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
    return;
  }

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
