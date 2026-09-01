import type { LlmClient } from '../llm/client.js';
import { classifyQuestion } from './sensitive.js';
import { findReusableAnswer } from './answer-reuse.js';
import type { FormQuestion } from './schemas/greenhouse.js';

export interface ProposedAnswer {
  fieldId: string;
  label: string;
  answer: string;
  source: 'profile' | 'cv' | 'reused_answer' | 'generated';
}

export interface PendingQuestion {
  fieldId: string;
  questionText: string;
  isSensitive: boolean;
}

export interface PrefillResult {
  proposedAnswers: ProposedAnswer[];
  pendingQuestions: PendingQuestion[];
}

export interface PrefillProfile {
  id: string;
  email: string;
  yoe: number | null;
  keywords: string[];
}

/**
 * Known scope limit: UserProfile only has `email`, `yoe`, and `keywords` —
 * there is no structured name/phone/LinkedIn field (CV interpretation,
 * T033, only extracts keywords + YoE). Fields like "First Name" that
 * would normally come straight from the profile have nothing to map to
 * yet, so they become `pending_needs_answer` like anything else the
 * system can't confidently answer, rather than being silently skipped or
 * guessed. Extending CV interpretation to extract name/contact fields is
 * a real, worthwhile follow-up — not done here since it wasn't asked for.
 */
const DIRECT_FIELD_MAP: Record<string, (profile: PrefillProfile) => string | null> = {
  email: (profile) => profile.email,
};

function matchesDirectField(label: string): ((profile: PrefillProfile) => string | null) | null {
  const normalised = label.toLowerCase();
  if (normalised.includes('email')) return DIRECT_FIELD_MAP.email;
  return null;
}

async function draftAnswer(
  question: FormQuestion,
  profile: PrefillProfile,
  llm: LlmClient,
): Promise<string | null> {
  const optionsHint =
    question.fields[0]?.values.length > 0
      ? `\nValid options (answer with EXACTLY one of these labels): ${question.fields[0].values.map((v) => v.label).join(', ')}`
      : '';

  const prompt = `You are drafting one answer for a job application form field on behalf of a candidate.

Candidate profile: ${profile.yoe ?? 'unknown'} years of experience. Skills/keywords: ${profile.keywords.join(', ') || 'none recorded'}.

Question: "${question.label}"${optionsHint}

If you can answer this confidently and truthfully from the profile above, respond with ONLY the
answer text (or, if options were listed, ONLY one of those exact option labels) and nothing else.
If you cannot answer this from the profile above (not enough information, or it asks for
information not in the profile), respond with exactly: UNKNOWN`;

  const raw = (await llm.complete(prompt)).trim();
  if (!raw || raw.toUpperCase() === 'UNKNOWN') return null;
  return raw;
}

/**
 * Prepares an answer sheet for one application. Sensitive questions
 * (FR-022) and anything else the system can't confidently answer become
 * `pendingQuestions` — never guessed. `findReusableAnswer` (T066) is
 * checked before drafting a new one, so the same question doesn't get
 * re-asked/re-drafted across applications once the user has answered it.
 */
export async function prefillApplication(
  questions: FormQuestion[],
  profile: PrefillProfile,
  llm: LlmClient,
): Promise<PrefillResult> {
  const proposedAnswers: ProposedAnswer[] = [];
  const pendingQuestions: PendingQuestion[] = [];

  for (const question of questions) {
    const fieldId = question.fields[0]?.name ?? question.label;
    const { isSensitive } = classifyQuestion(question.label);

    if (isSensitive) {
      pendingQuestions.push({ fieldId, questionText: question.label, isSensitive: true });
      continue;
    }

    const directField = matchesDirectField(question.label);
    if (directField) {
      const value = directField(profile);
      if (value) {
        proposedAnswers.push({ fieldId, label: question.label, answer: value, source: 'profile' });
        continue;
      }
    }

    const reused = await findReusableAnswer(profile.id, question.label);
    if (reused) {
      proposedAnswers.push({ fieldId, label: question.label, answer: reused, source: 'reused_answer' });
      continue;
    }

    const drafted = await draftAnswer(question, profile, llm);
    if (drafted) {
      proposedAnswers.push({ fieldId, label: question.label, answer: drafted, source: 'generated' });
    } else {
      pendingQuestions.push({ fieldId, questionText: question.label, isSensitive: false });
    }
  }

  return { proposedAnswers, pendingQuestions };
}
