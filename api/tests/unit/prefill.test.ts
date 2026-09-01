import { prisma } from '../../src/lib/prisma.js';
import { prefillApplication } from '../../src/apply/prefill.js';
import { recordAnswer } from '../../src/apply/answer-reuse.js';
import type { LlmClient } from '../../src/llm/client.js';
import type { FormQuestion } from '../../src/apply/schemas/greenhouse.js';

function fakeLlm(responder: (prompt: string) => string): LlmClient {
  return { complete: async (prompt: string) => responder(prompt) };
}

function question(label: string, values: Array<{ label: string; value: number }> = []): FormQuestion {
  return {
    label,
    required: true,
    fields: [{ name: label.toLowerCase().replace(/\s+/g, '_'), type: values.length ? 'multi_value_single_select' : 'input_text', values }],
  };
}

async function seedProfile(email: string) {
  return prisma.userProfile.create({ data: { email, yoe: 5, keywords: ['TypeScript', 'PostgreSQL'] } });
}

afterEach(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-prefill-' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('prefillApplication', () => {
  it('routes a sensitive question straight to pendingQuestions without ever calling the LLM', async () => {
    const profile = await seedProfile(`test-prefill-sensitive-${Date.now()}@example.com`);
    let llmCalled = false;
    const llm = fakeLlm(() => {
      llmCalled = true;
      return 'should not happen';
    });

    const result = await prefillApplication([question('Expected salary?')], profile, llm);

    expect(llmCalled).toBe(false);
    expect(result.pendingQuestions).toHaveLength(1);
    expect(result.pendingQuestions[0].isSensitive).toBe(true);
    expect(result.proposedAnswers).toHaveLength(0);
  });

  it('fills an email field directly from the profile, source=profile', async () => {
    const profile = await seedProfile(`test-prefill-email-${Date.now()}@example.com`);
    const llm = fakeLlm(() => 'should not be called');

    const result = await prefillApplication([question('Email address')], profile, llm);

    expect(result.proposedAnswers).toHaveLength(1);
    expect(result.proposedAnswers[0]).toMatchObject({ answer: profile.email, source: 'profile' });
  });

  it('reuses a prior answer before asking the LLM to draft one', async () => {
    const profile = await seedProfile(`test-prefill-reuse-${Date.now()}@example.com`);
    const posting = await prisma.jobPosting.create({
      data: { sourceProvider: 'test-prefill-seed', externalRef: `r-${Date.now()}`, title: 't', employer: 'e', requirementsSummary: '', language: 'en', market: 'HK', applyRoute: 'direct_submit_allowlisted' },
    });
    const interaction = await prisma.jobInteraction.create({ data: { profileId: profile.id, jobPostingId: posting.id, direction: 'right' } });
    const application = await prisma.application.create({ data: { jobInteractionId: interaction.id, submissionMode: 'auto_submit', applyRoute: 'direct_submit_allowlisted', status: 'queued' } });
    await recordAnswer({ applicationId: application.id, profileId: profile.id, questionText: 'Favorite build tool?', answer: 'esbuild', isSensitive: false });

    let llmCalled = false;
    const llm = fakeLlm(() => {
      llmCalled = true;
      return 'wrong answer';
    });

    const result = await prefillApplication([question('Favorite build tool?')], profile, llm);

    expect(llmCalled).toBe(false);
    expect(result.proposedAnswers[0]).toMatchObject({ answer: 'esbuild', source: 'reused_answer' });

    await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-prefill-seed' } });
  });

  it('drafts an answer via the LLM for an ordinary question with no direct mapping', async () => {
    const profile = await seedProfile(`test-prefill-draft-${Date.now()}@example.com`);
    const llm = fakeLlm((prompt) => {
      expect(prompt).toContain('TypeScript');
      return 'I enjoy building backend systems with TypeScript.';
    });

    const result = await prefillApplication([question('Why are you interested in this role?')], profile, llm);

    expect(result.proposedAnswers).toHaveLength(1);
    expect(result.proposedAnswers[0]).toMatchObject({
      answer: 'I enjoy building backend systems with TypeScript.',
      source: 'generated',
    });
  });

  it('moves a question to pendingQuestions when the LLM cannot answer it confidently', async () => {
    const profile = await seedProfile(`test-prefill-unknown-${Date.now()}@example.com`);
    const llm = fakeLlm(() => 'UNKNOWN');

    const result = await prefillApplication([question('What is your favorite childhood memory?')], profile, llm);

    expect(result.proposedAnswers).toHaveLength(0);
    expect(result.pendingQuestions).toHaveLength(1);
    expect(result.pendingQuestions[0].isSensitive).toBe(false);
  });

  it('gives the LLM the exact option labels for a select-type field', async () => {
    const profile = await seedProfile(`test-prefill-select-${Date.now()}@example.com`);
    const llm = fakeLlm((prompt) => {
      expect(prompt).toContain('Yes');
      expect(prompt).toContain('No');
      return 'No';
    });

    const q = question('Have you worked here before?', [
      { label: 'Yes', value: 1 },
      { label: 'No', value: 2 },
    ]);
    const result = await prefillApplication([q], profile, llm);

    expect(result.proposedAnswers[0].answer).toBe('No');
  });
});
