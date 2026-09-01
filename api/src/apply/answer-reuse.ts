import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

/**
 * ponytail: exact match on normalised (trimmed, lowercased) question text,
 * not fuzzy/semantic "substantially similar" matching. A simple, correct
 * baseline — two ATS vendors phrasing "expected salary" differently won't
 * dedupe yet, which just means the user answers it again once per
 * distinct phrasing, not incorrectly. Upgrade path: embedding-based
 * similarity if that turns out to matter in practice.
 */
export function fingerprintQuestion(questionText: string): string {
  return createHash('sha256').update(questionText.trim().toLowerCase()).digest('hex');
}

/** FR-021: reuse a prior answer to the same question, never for sensitive ones (FR-022). */
export async function findReusableAnswer(profileId: string, questionText: string): Promise<string | null> {
  const existing = await prisma.applicationQuestion.findFirst({
    where: {
      profileId,
      questionFingerprint: fingerprintQuestion(questionText),
      isSensitive: false,
      answer: { not: null },
    },
    orderBy: { answeredAt: 'desc' },
  });
  return existing?.answer ?? null;
}

export interface RecordAnswerParams {
  applicationId: string;
  profileId: string;
  questionText: string;
  answer: string;
  isSensitive: boolean;
}

export async function recordAnswer(params: RecordAnswerParams): Promise<void> {
  await prisma.applicationQuestion.create({
    data: {
      applicationId: params.applicationId,
      profileId: params.profileId,
      questionText: params.questionText,
      questionFingerprint: fingerprintQuestion(params.questionText),
      isSensitive: params.isSensitive,
      answer: params.answer,
      answeredAt: new Date(),
    },
  });
}
