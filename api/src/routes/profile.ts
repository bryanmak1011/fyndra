import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { extractText, NoTextLayerError, PasswordProtectedError, UnsupportedFormatError } from '../cv/extract.js';
import { storeCv } from '../cv/storage.js';
import { enqueue } from '../queue/index.js';
import { ApiError } from '../lib/errors.js';
import { validateBody } from '../middleware/validate.js';

export const profileRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const LANGUAGE_TO_API = { en: 'en', zh_Hant: 'zh-Hant', mixed: 'mixed' } as const;

function serializeCvDocument(doc: {
  id: string;
  fileFormat: string;
  parseStatus: string;
  detectedLanguage: string | null;
  rawExtractedKeywords: string[];
  rawExtractedYoe: number | null;
}) {
  return {
    id: doc.id,
    fileFormat: doc.fileFormat,
    parseStatus: doc.parseStatus,
    detectedLanguage: doc.detectedLanguage
      ? LANGUAGE_TO_API[doc.detectedLanguage as keyof typeof LANGUAGE_TO_API]
      : null,
    rawExtractedKeywords: doc.rawExtractedKeywords,
    rawExtractedYoe: doc.rawExtractedYoe,
  };
}

// POST /profile/cv (FR-001, FR-002) — format/text-layer validation is
// synchronous; the LLM interpretation step is queued (contracts/openapi.yaml).
profileRouter.post('/cv', upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    next(new ApiError(400, 'invalid_request', 'No file field named "file" in the request'));
    return;
  }

  let extracted;
  try {
    extracted = await extractText(req.file.buffer);
  } catch (err) {
    if (err instanceof NoTextLayerError) {
      next(new ApiError(422, 'no_text_layer', err.message));
    } else if (err instanceof PasswordProtectedError) {
      next(new ApiError(422, 'password_protected', err.message));
    } else if (err instanceof UnsupportedFormatError) {
      next(new ApiError(422, 'unsupported_format', err.message));
    } else {
      next(err);
    }
    return;
  }

  const storageRef = await storeCv(req.file.buffer);
  const doc = await prisma.cvDocument.create({
    data: {
      profileId: req.profileId!,
      fileFormat: extracted.format,
      storageRef,
      parseStatus: 'parsing',
    },
  });

  await enqueue('parse_cv', { cvDocumentId: doc.id });

  res.status(202).json(serializeCvDocument(doc));
});

// GET /profile/cv — most recent upload's parse result, for the user to
// review/confirm (FR-003).
profileRouter.get('/cv', async (req, res, next) => {
  const doc = await prisma.cvDocument.findFirst({
    where: { profileId: req.profileId! },
    orderBy: { createdAt: 'desc' },
  });
  if (!doc) {
    next(new ApiError(404, 'not_found', 'No CV uploaded yet'));
    return;
  }
  res.status(200).json(serializeCvDocument(doc));
});

function serializeProfile(profile: {
  id: string;
  email: string;
  yoe: number | null;
  keywords: string[];
  submissionMode: string;
  markets: string[];
  preferredLanguage: string;
  dailySubmissionCap: number;
}, submissionsUsedToday: number) {
  return {
    id: profile.id,
    email: profile.email,
    yoe: profile.yoe,
    keywords: profile.keywords,
    submissionMode: profile.submissionMode,
    markets: profile.markets,
    preferredLanguage: LANGUAGE_TO_API[profile.preferredLanguage as keyof typeof LANGUAGE_TO_API],
    dailySubmissionCap: profile.dailySubmissionCap,
    submissionsUsedToday,
  };
}

async function countSubmissionsToday(profileId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.application.count({
    where: {
      jobInteraction: { profileId },
      status: 'applied',
      submittedAt: { gte: startOfDay },
    },
  });
}

profileRouter.get('/', async (req, res) => {
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { id: req.profileId! } });
  const submissionsUsedToday = await countSubmissionsToday(req.profileId!);
  res.status(200).json(serializeProfile(profile, submissionsUsedToday));
});

const API_TO_LANGUAGE = { en: 'en', 'zh-Hant': 'zh_Hant', mixed: 'mixed' } as const;

const updateSchema = z.object({
  yoe: z.number().int().min(0).max(80).optional(),
  keywords: z.array(z.string()).optional(),
  submissionMode: z.enum(['review_before_sending', 'auto_submit']).optional(),
  markets: z.array(z.enum(['HK', 'TW'])).optional(),
  preferredLanguage: z.enum(['en', 'zh-Hant', 'mixed']).optional(),
  dailySubmissionCap: z.number().int().min(1).max(100).optional(),
});

// PATCH /profile — the confirmation step FR-003 requires: raw extraction
// is never applied to the profile until the user reviews and submits it
// here (or edits it first).
profileRouter.patch('/', validateBody(updateSchema), async (req, res) => {
  const body = req.body as z.infer<typeof updateSchema>;
  const profile = await prisma.userProfile.update({
    where: { id: req.profileId! },
    data: {
      ...(body.yoe !== undefined && { yoe: body.yoe }),
      ...(body.keywords !== undefined && { keywords: body.keywords }),
      ...(body.submissionMode !== undefined && { submissionMode: body.submissionMode }),
      ...(body.markets !== undefined && { markets: body.markets }),
      ...(body.preferredLanguage !== undefined && {
        preferredLanguage: API_TO_LANGUAGE[body.preferredLanguage],
      }),
      ...(body.dailySubmissionCap !== undefined && { dailySubmissionCap: body.dailySubmissionCap }),
    },
  });
  const submissionsUsedToday = await countSubmissionsToday(req.profileId!);
  res.status(200).json(serializeProfile(profile, submissionsUsedToday));
});
