import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { Errors } from '../lib/errors.js';
import { validateBody } from '../middleware/validate.js';
import { recordAnswer } from '../apply/answer-reuse.js';
import { isValidTransition } from '../apply/status-transitions.js';

export const applicationsRouter = Router();

async function loadOwnedApplication(applicationId: string, profileId: string) {
  return prisma.application.findFirst({
    where: { id: applicationId, jobInteraction: { profileId } },
    include: { jobInteraction: true },
  });
}

// GET /applications (T077) — status filtering per contracts/openapi.yaml.
const listQuerySchema = z.object({
  status: z.union([z.string(), z.array(z.string())]).optional(),
});

applicationsRouter.get('/', async (req, res, next) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }
  const statusFilter = parsed.data.status
    ? Array.isArray(parsed.data.status)
      ? parsed.data.status
      : [parsed.data.status]
    : undefined;

  const applications = await prisma.application.findMany({
    where: {
      jobInteraction: { profileId: req.profileId! },
      ...(statusFilter && { status: { in: statusFilter as never[] } }),
    },
    orderBy: { createdAt: 'desc' },
  });

  res.status(200).json(
    applications.map((a) => ({
      id: a.id,
      submissionMode: a.submissionMode,
      applyRoute: a.applyRoute,
      status: a.status,
      failureReason: a.failureReason,
      employerApplyUrl: a.employerApplyUrl,
      submittedAt: a.submittedAt?.toISOString() ?? null,
    })),
  );
});

// GET /applications/{id} (T077) — includes status history.
applicationsRouter.get('/:id', async (req, res, next) => {
  const application = await loadOwnedApplication(req.params.id, req.profileId!);
  if (!application) {
    next(Errors.notFound('Application not found'));
    return;
  }

  const statusHistory = await prisma.applicationStatusEvent.findMany({
    where: { applicationId: application.id },
    orderBy: { occurredAt: 'asc' },
  });

  const detail = await serializeApplication(application.id);
  res.status(200).json({
    ...detail,
    statusHistory: statusHistory.map((e) => ({
      status: e.status,
      occurredAt: e.occurredAt.toISOString(),
      note: e.note,
    })),
  });
});

const statusUpdateSchema = z.object({
  status: z.enum(['responded', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']),
  note: z.string().optional(),
});

// POST /applications/{id}/status (T078, FR-011a)
applicationsRouter.post('/:id/status', validateBody(statusUpdateSchema), async (req, res, next) => {
  const application = await loadOwnedApplication(req.params.id, req.profileId!);
  if (!application) {
    next(Errors.notFound('Application not found'));
    return;
  }

  const { status: nextStatus, note } = req.body as z.infer<typeof statusUpdateSchema>;
  if (!isValidTransition(application.status, nextStatus)) {
    next(Errors.conflict('invalid_transition', `Cannot move from ${application.status} to ${nextStatus}`));
    return;
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: application.id }, data: { status: nextStatus } }),
    prisma.applicationStatusEvent.create({ data: { applicationId: application.id, status: nextStatus, note } }),
  ]);

  res.status(200).json(await serializeApplication(application.id));
});

async function serializeApplication(applicationId: string) {
  const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  const [answerSheet, pendingQuestions] = await Promise.all([
    prisma.proposedAnswer.findMany({ where: { applicationId } }),
    prisma.applicationQuestion.findMany({ where: { applicationId, answer: null } }),
  ]);

  return {
    id: application.id,
    submissionMode: application.submissionMode,
    applyRoute: application.applyRoute,
    status: application.status,
    failureReason: application.failureReason,
    employerApplyUrl: application.employerApplyUrl,
    submittedAt: application.submittedAt?.toISOString() ?? null,
    answerSheet: answerSheet.map((a) => ({
      fieldId: a.fieldId,
      label: a.label,
      answer: a.answer,
      source: a.source,
    })),
    pendingQuestions: pendingQuestions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      isSensitive: q.isSensitive,
      answer: q.answer,
    })),
  };
}

const confirmSchema = z.object({
  editedAnswers: z.array(z.object({ fieldId: z.string(), answer: z.string() })).optional(),
});

// POST /applications/{id}/confirm (FR-008, FR-018) — direct submission
// has no real channel for any provider right now (apply-route.ts's
// 2026-09-01 note, BLOCKERS.md); every confirm currently hands off to
// the user rather than submitting.
applicationsRouter.post('/:id/confirm', validateBody(confirmSchema), async (req, res, next) => {
  const application = await loadOwnedApplication(req.params.id, req.profileId!);
  if (!application) {
    next(Errors.notFound('Application not found'));
    return;
  }
  if (application.status !== 'awaiting_review') {
    next(Errors.conflict('invalid_transition', `Cannot confirm from status ${application.status}`));
    return;
  }

  const { editedAnswers } = req.body as z.infer<typeof confirmSchema>;
  if (editedAnswers?.length) {
    await Promise.all(
      editedAnswers.map((edit) =>
        prisma.proposedAnswer.updateMany({
          where: { applicationId: application.id, fieldId: edit.fieldId },
          data: { answer: edit.answer, editedByUser: true },
        }),
      ),
    );
  }

  await prisma.$transaction([
    prisma.application.update({ where: { id: application.id }, data: { status: 'handed_off' } }),
    prisma.applicationStatusEvent.create({ data: { applicationId: application.id, status: 'handed_off' } }),
  ]);

  res.status(202).json(await serializeApplication(application.id));
});

// POST /applications/{id}/handoff-complete (FR-025)
applicationsRouter.post('/:id/handoff-complete', async (req, res, next) => {
  const application = await loadOwnedApplication(req.params.id, req.profileId!);
  if (!application) {
    next(Errors.notFound('Application not found'));
    return;
  }
  if (application.status !== 'handed_off') {
    next(Errors.conflict('invalid_transition', `Cannot mark applied from status ${application.status}`));
    return;
  }

  await prisma.$transaction([
    prisma.application.update({
      where: { id: application.id },
      data: { status: 'applied', submittedAt: new Date() },
    }),
    prisma.applicationStatusEvent.create({ data: { applicationId: application.id, status: 'applied' } }),
  ]);

  res.status(200).json(await serializeApplication(application.id));
});

const answerSchema = z.object({ answer: z.string().min(1) });

// POST /applications/{id}/questions/{questionId}/answer (FR-020, FR-021, FR-022)
applicationsRouter.post(
  '/:id/questions/:questionId/answer',
  validateBody(answerSchema),
  async (req, res, next) => {
    const application = await loadOwnedApplication(req.params.id, req.profileId!);
    if (!application) {
      next(Errors.notFound('Application not found'));
      return;
    }

    const question = await prisma.applicationQuestion.findFirst({
      where: { id: req.params.questionId, applicationId: application.id },
    });
    if (!question) {
      next(Errors.notFound('Question not found'));
      return;
    }

    const { answer } = req.body as z.infer<typeof answerSchema>;
    await prisma.applicationQuestion.update({
      where: { id: question.id },
      data: { answer, answeredAt: new Date() },
    });

    // FR-022: sensitive answers are never cached for reuse across applications.
    if (!question.isSensitive) {
      await recordAnswer({
        applicationId: application.id,
        profileId: application.jobInteraction.profileId,
        questionText: question.questionText,
        answer,
        isSensitive: false,
      });
    }

    const remainingUnanswered = await prisma.applicationQuestion.count({
      where: { applicationId: application.id, answer: null },
    });
    if (remainingUnanswered === 0 && application.status === 'pending_needs_answer') {
      await prisma.$transaction([
        prisma.application.update({ where: { id: application.id }, data: { status: 'awaiting_review' } }),
        prisma.applicationStatusEvent.create({
          data: { applicationId: application.id, status: 'awaiting_review' },
        }),
      ]);
    }

    res.status(202).json(await serializeApplication(application.id));
  },
);
