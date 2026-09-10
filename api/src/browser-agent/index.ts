import { chromium } from 'playwright';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/index.js';
import { loadSessionState } from './session.js';
import { captureEvidence } from './evidence.js';
import { isBrowserAutomationAllowed } from './gate.js';
import { toBrowserSubmitError, SessionExpiredError, type BrowserSubmitError } from './errors.js';
import { jobsdbHkProvider } from './providers/jobsdb-hk.js';
import { tw104Provider } from './providers/tw104.js';
import type { BrowserSubmitProvider, ProposedAnswerLike } from './providers/types.js';

const PROVIDERS: Record<string, BrowserSubmitProvider> = {
  'jobsdb-hk': jobsdbHkProvider,
  tw104: tw104Provider,
};

// A pending_click row older than this is treated as abandoned (worker
// crashed mid-attempt), not "still running" — see the idempotency check
// below.
const IN_FLIGHT_WINDOW_MS = 5 * 60 * 1000;

export interface BrowserSubmitInput {
  applicationId: string;
  profileId: string;
  sourceProvider: string;
  employerApplyUrl: string | null;
  answers: ProposedAnswerLike[];
}

/**
 * The browser-automation counterpart to handoff.ts's prepareHandoff —
 * called from apply/state-machine.ts's handleSubmit when
 * determineApplyRoute resolves to `browser_automated`. Unlike an API
 * call, a browser click has no natural idempotency key, so this function
 * itself enforces "at most one real click per Application, ever" via the
 * SubmissionAttempt table (see schema.prisma's comment on that model)
 * before it ever launches a browser.
 */
export async function attemptBrowserSubmit(input: BrowserSubmitInput): Promise<void> {
  const { applicationId, profileId, sourceProvider, employerApplyUrl, answers } = input;

  if (!isBrowserAutomationAllowed(profileId)) {
    throw new Error(`browser automation not enabled for profile ${profileId}`);
  }
  if (!employerApplyUrl) {
    throw new Error('cannot attempt browser submission without an employerApplyUrl');
  }
  const provider = PROVIDERS[sourceProvider];
  if (!provider) {
    throw new Error(`no browser-submit provider registered for source provider "${sourceProvider}"`);
  }

  const priorAttempts = await prisma.submissionAttempt.findMany({
    where: { applicationId },
    orderBy: { startedAt: 'desc' },
  });
  if (priorAttempts.some((a) => a.outcome === 'submitted')) {
    logger.info('browser_submit_already_submitted', { applicationId });
    return;
  }
  const recentPending = priorAttempts.find(
    (a) => a.outcome === 'pending_click' && Date.now() - a.startedAt.getTime() < IN_FLIGHT_WINDOW_MS,
  );
  if (recentPending) {
    logger.info('browser_submit_recent_pending_skip', { applicationId, attemptId: recentPending.id });
    return;
  }

  const attempt = await prisma.submissionAttempt.create({
    data: {
      applicationId,
      provider: sourceProvider,
      attemptNumber: priorAttempts.length + 1,
      outcome: 'pending_click',
    },
  });

  const sessionState = await loadSessionState(sourceProvider);
  if (!sessionState) {
    await failAttempt(attempt.id, applicationId, new SessionExpiredError(sourceProvider));
    return;
  }

  const browser = await chromium.launch({ headless: config.browserAutomationHeadless });
  try {
    const context = await browser.newContext({ storageState: sessionState as never });
    try {
      await provider.submit(context, { employerApplyUrl }, answers);

      const page = context.pages()[0] ?? (await context.newPage());
      const { screenshotPath, finalUrl } = await captureEvidence(page, attempt.id);

      await prisma.$transaction([
        prisma.submissionAttempt.update({
          where: { id: attempt.id },
          data: { outcome: 'submitted', finishedAt: new Date(), screenshotPath, finalUrl },
        }),
        prisma.application.update({
          where: { id: applicationId },
          data: { status: 'auto_submitted', submittedAt: new Date(), lastAttemptRef: attempt.id },
        }),
        prisma.applicationStatusEvent.create({
          data: { applicationId, status: 'auto_submitted', note: `SubmissionAttempt ${attempt.id}` },
        }),
      ]);
    } finally {
      await context.close();
    }
  } catch (err) {
    await failAttempt(attempt.id, applicationId, toBrowserSubmitError(err));
  } finally {
    await browser.close();
  }
}

// Every failure path — selector miss, bot wall, CAPTCHA, expired session,
// or anything unclassified — lands the Application on `needs_attention`
// with a specific failureReason. No branch of attemptBrowserSubmit is
// allowed to leave the job "succeeded" without a `submitted`
// SubmissionAttempt row; this is the one place that invariant is enforced.
async function failAttempt(attemptId: string, applicationId: string, err: BrowserSubmitError): Promise<void> {
  logger.error('browser_submit_failed', {
    applicationId,
    attemptId,
    error: err.message,
    outcome: err.outcome,
  });
  await prisma.$transaction([
    prisma.submissionAttempt.update({
      where: { id: attemptId },
      data: { outcome: err.outcome, finishedAt: new Date(), errorDetail: err.message.slice(0, 500) },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: 'needs_attention', failureReason: err.failureReason },
    }),
    prisma.applicationStatusEvent.create({
      data: { applicationId, status: 'needs_attention', note: err.message.slice(0, 500) },
    }),
  ]);
}
