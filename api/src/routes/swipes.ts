import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { ApiError, Errors } from '../lib/errors.js';
import { submissionsToday, openApplicationsForEmployer } from '../lib/caps.js';
import { enqueue } from '../queue/index.js';

export const swipesRouter = Router();

const paramsSchema = z.object({ jobId: z.string().uuid() });
const bodySchema = z.object({ direction: z.enum(['left', 'right']) });

function serializeApplication(app: {
  id: string;
  jobInteractionId: string;
  submissionMode: string;
  applyRoute: string;
  status: string;
  failureReason: string | null;
  employerApplyUrl: string | null;
  submittedAt: Date | null;
}) {
  return {
    id: app.id,
    submissionMode: app.submissionMode,
    applyRoute: app.applyRoute,
    status: app.status,
    failureReason: app.failureReason,
    employerApplyUrl: app.employerApplyUrl,
    submittedAt: app.submittedAt?.toISOString() ?? null,
    answerSheet: [],
    pendingQuestions: [],
  };
}

// POST /jobs/{jobId}/swipe (FR-005, FR-006, FR-007, FR-014, FR-023) —
// records the swipe immediately and, for a right swipe, queues the
// application rather than attempting anything synchronously (D8: a
// submission attempt is 30s-2min, far past any request budget).
swipesRouter.post('/:jobId/swipe', async (req, res, next) => {
  const params = paramsSchema.safeParse(req.params);
  const body = bodySchema.safeParse(req.body);
  if (!params.success || !body.success) {
    next(new ApiError(400, 'invalid_request', 'Invalid jobId or direction'));
    return;
  }
  const { jobId } = params.data;
  const { direction } = body.data;
  const profileId = req.profileId!;

  const posting = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!posting) {
    next(Errors.gone('Job posting no longer available'));
    return;
  }

  // Idempotent: re-swiping the same job (e.g. after reinstall) returns the
  // existing interaction rather than erroring or duplicating (FR-014).
  const interaction = await prisma.jobInteraction.upsert({
    where: { profileId_jobPostingId: { profileId, jobPostingId: jobId } },
    create: { profileId, jobPostingId: jobId, direction },
    update: {},
    include: { application: true },
  });

  if (direction === 'left' || interaction.application) {
    res.status(202).json({
      interactionId: interaction.id,
      direction: interaction.direction,
      application: interaction.application ? serializeApplication(interaction.application) : null,
    });
    return;
  }

  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: profileId } });
  const [usedToday, employerOpen] = await Promise.all([
    submissionsToday(profileId),
    openApplicationsForEmployer(profileId, posting.employer),
  ]);
  if (usedToday >= profile.dailySubmissionCap || employerOpen >= profile.perEmployerCap) {
    next(Errors.conflict('cap_reached', 'Daily or per-employer submission cap reached'));
    return;
  }

  const application = await prisma.application.create({
    data: {
      jobInteractionId: interaction.id,
      submissionMode: profile.submissionMode,
      applyRoute: posting.applyRoute,
      employerApplyUrl: posting.employerApplyUrl,
      status: 'queued',
    },
  });
  await prisma.applicationStatusEvent.create({ data: { applicationId: application.id, status: 'queued' } });
  // The `submit` handler lands in T069; enqueuing now means today's swipes
  // process automatically once it exists, rather than being lost.
  await enqueue('submit', { applicationId: application.id });

  res.status(202).json({
    interactionId: interaction.id,
    direction,
    application: serializeApplication(application),
  });
});
