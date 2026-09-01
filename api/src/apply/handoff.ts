import { fetchGreenhouseFormSchema, extractGreenhouseJobId } from './schemas/greenhouse.js';
import { prefillApplication, type PrefillProfile, type PrefillResult } from './prefill.js';
import type { LlmClient } from '../llm/client.js';

export interface HandoffPosting {
  sourceProvider: string;
  employerApplyUrl: string | null;
}

const EMPTY_RESULT: PrefillResult = { proposedAnswers: [], pendingQuestions: [] };

function extractGreenhouseBoardToken(url: string): string | null {
  const match = url.match(/greenhouse\.io\/([^/]+)\/jobs\//);
  return match ? match[1] : null;
}

/**
 * Prepares the answer sheet a user sees before completing a handed-off
 * application themselves (FR-025). Only Greenhouse has a known
 * form-schema reader (T064) — every other provider has no structured
 * field list to prefill against, so the sheet there is simply empty
 * (the user fills the real external form directly; the app has nothing
 * more specific to offer than the deep link itself). This is honest
 * about what's actually possible today, not a placeholder pretending to
 * be complete.
 */
export async function prepareHandoff(
  posting: HandoffPosting,
  profile: PrefillProfile,
  llm: LlmClient,
): Promise<PrefillResult> {
  if (!posting.employerApplyUrl) return EMPTY_RESULT;

  if (posting.sourceProvider === 'greenhouse') {
    const jobId = extractGreenhouseJobId(posting.employerApplyUrl);
    const boardToken = extractGreenhouseBoardToken(posting.employerApplyUrl);
    if (jobId && boardToken) {
      const questions = await fetchGreenhouseFormSchema(boardToken, jobId);
      return prefillApplication(questions, profile, llm);
    }
  }

  return EMPTY_RESULT;
}
