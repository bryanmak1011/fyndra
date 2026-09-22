import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateBearerToken, generateOneTimeCode, hashSecret } from '../lib/crypto.js';
import { validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { ApiError } from '../lib/errors.js';

export const authRouter = Router();

const requestCodeSchema = z.object({ email: z.string().email() });
const verifySchema = z.object({ email: z.string().email(), code: z.string().length(6) });

const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Mints a bearer token and returns the same body `/auth/verify` does. Both
 * sign-in paths go through here so the bypass cannot drift into issuing a
 * differently-scoped or longer-lived token than a real sign-in.
 */
async function issueSession(profile: {
  id: string;
  email: string;
  yoe: number | null;
  keywords: string[];
  submissionMode: string;
  markets: string[];
  preferredLanguage: string;
  dailySubmissionCap: number;
}) {
  const token = generateBearerToken();
  const expiresAt = new Date(Date.now() + config.authTokenTtlDays * 24 * 60 * 60 * 1000);
  await prisma.authToken.create({
    data: { profileId: profile.id, tokenHash: hashSecret(token), expiresAt },
  });

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    profile: {
      id: profile.id,
      email: profile.email,
      yoe: profile.yoe,
      keywords: profile.keywords,
      submissionMode: profile.submissionMode,
      markets: profile.markets,
      preferredLanguage: profile.preferredLanguage.replace('zh_Hant', 'zh-Hant'),
      dailySubmissionCap: profile.dailySubmissionCap,
    },
  };
}

/**
 * Whether this address skips one-time-code verification entirely. See
 * config/index.ts's loadAuthBypassEmails: the list is empty unless
 * explicitly configured, and a production server carrying it refuses to
 * boot. Compared case-insensitively because the caller controls the casing
 * of what they send.
 */
function isBypassAccount(email: string): boolean {
  return config.authBypassEmails.includes(email.trim().toLowerCase());
}

// POST /auth/request-code (FR-026) — always 202, whether or not the
// account exists, so the endpoint can't be used to enumerate emails.
authRouter.post(
  '/request-code',
  // 5/60s was too tight even for legitimate use: it broke this project's
  // own test suite (many fresh test accounts, one client "IP"), which
  // means it would just as easily false-positive on a real shared-IP
  // scenario (office NAT, campus Wi-Fi) with several genuine sign-ups in
  // a short window. 20/15min still meaningfully blocks a spam script.
  rateLimit(15 * 60_000, 20),
  validateBody(requestCodeSchema),
  async (req, res) => {
    const { email } = req.body as z.infer<typeof requestCodeSchema>;

    const profile = await prisma.userProfile.upsert({
      where: { email },
      update: {},
      create: { email },
    });

    // Test accounts skip the code entirely (non-production only). The
    // response still uses 202 and still says nothing about whether the
    // account exists — a caller who is not on the list gets `{}` here and
    // cannot tell a bypass account apart from an ordinary one.
    if (isBypassAccount(email)) {
      logger.warn('auth_code_bypassed', { email });
      res.status(202).json({ session: await issueSession(profile) });
      return;
    }

    const code = generateOneTimeCode();
    await prisma.authCode.create({
      data: {
        profileId: profile.id,
        codeHash: hashSecret(code),
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });

    // ponytail: no email provider wired yet — DEBUG builds read the code
    // from this log line, per quickstart.md step 1b. Wire a real sender
    // (SES/Postmark) before Phase 2 (cloud deployment).
    if (config.nodeEnv !== 'production') {
      logger.info('auth_code_issued', { email, code });
    }

    res.status(202).json({});
  },
);

authRouter.post('/verify', validateBody(verifySchema), async (req, res, next) => {
  const { email, code } = req.body as z.infer<typeof verifySchema>;

  const profile = await prisma.userProfile.findUnique({ where: { email } });
  if (!profile) {
    next(new ApiError(401, 'invalid_code', 'Invalid or expired code'));
    return;
  }

  const record = await prisma.authCode.findFirst({
    where: { profileId: profile.id, codeHash: hashSecret(code), consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!record || record.expiresAt < new Date()) {
    next(new ApiError(401, 'invalid_code', 'Invalid or expired code'));
    return;
  }

  await prisma.authCode.update({ where: { id: record.id }, data: { consumedAt: new Date() } });

  res.status(200).json(await issueSession(profile));
});
