import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXED_CODE = '424242';

jest.unstable_mockModule('../../src/lib/crypto.js', () => ({
  hashSecret: (secret: string) => createHash('sha256').update(secret).digest('hex'),
  generateBearerToken: () => randomBytes(32).toString('base64url'),
  generateOneTimeCode: () => FIXED_CODE,
}));

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/lib/prisma.js');
const { handleSubmit } = await import('../../src/apply/state-machine.js');

const app = createApp();

function greenhouseFixture(): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL('../unit/fixtures/greenhouse-job-detail.json', import.meta.url)), 'utf8'),
  );
}

// Mocks both network boundaries this flow touches — the Greenhouse schema
// fetch and the LLM completion call — so the test exercises the real
// handleSubmit/routes/state-machine code deterministically, offline. Live
// coverage of each boundary individually already exists elsewhere
// (tests/integration/cv-interpret-live.test.ts for the LLM; the manual
// live smoke run recorded in tasks.md for the Greenhouse fetch).
function mockNetwork(llmAnswer: string) {
  global.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('greenhouse.io')) {
      return new Response(JSON.stringify(greenhouseFixture()), { status: 200 });
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: llmAnswer } }] }),
      { status: 200 },
    );
  }) as typeof fetch;
}

async function authedProfile(overrides: { yoe?: number; keywords?: string[] } = {}) {
  const email = `test-applyflow-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  if (overrides.yoe !== undefined || overrides.keywords) {
    await prisma.userProfile.update({
      where: { id: verify.body.profile.id },
      data: { yoe: overrides.yoe, keywords: overrides.keywords },
    });
  }
  return { token: verify.body.token as string, profileId: verify.body.profile.id as string };
}

async function seedGreenhousePosting() {
  return prisma.jobPosting.create({
    data: {
      sourceProvider: 'greenhouse',
      externalRef: `apply-flow-${Date.now()}`,
      employerApplyUrl: 'https://job-boards.greenhouse.io/gitlab/jobs/8503792002',
      title: 'Backend Engineer',
      employer: 'GitLab',
      requirementsSummary: 'Remote',
      language: 'en',
      market: 'HK',
      applyRoute: 'handoff', // apply-route.ts: direct submit disabled for everyone right now
    },
  });
}

const originalFetch = global.fetch;
afterEach(async () => {
  global.fetch = originalFetch;
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'greenhouse', externalRef: { startsWith: 'apply-flow-' } } });
});

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-applyflow-' } } });
  await prisma.$disconnect();
});

describe('Full application state machine — data-model.md transitions', () => {
  it('queued -> pending_needs_answer -> awaiting_review -> handed_off -> applied', async () => {
    mockNetwork('UNKNOWN'); // LLM can't confidently answer non-sensitive questions either
    const { token } = await authedProfile({ yoe: 5, keywords: ['TypeScript'] });
    const posting = await seedGreenhousePosting();

    // 1. queued
    const swipe = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    expect(swipe.body.application.status).toBe('queued');
    const applicationId = swipe.body.application.id;

    // 2. Run the worker's handler directly (real code path).
    const queuedJob = await prisma.queueJob.findFirst({ where: { type: 'submit' }, orderBy: { createdAt: 'desc' } });
    await handleSubmit(queuedJob!.payload);

    // 3. pending_needs_answer — the sponsorship question is sensitive, and
    // the mocked LLM can't answer the rest either (fixture includes
    // non-sensitive questions with no direct profile mapping). Reading via
    // Prisma directly since GET /applications/{id} lands in US4 (T077).
    const applicationRow = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(applicationRow.status).toBe('pending_needs_answer');

    const pendingQuestions = await prisma.applicationQuestion.findMany({ where: { applicationId } });
    expect(pendingQuestions.length).toBeGreaterThan(0);
    const sponsorshipQuestion = pendingQuestions.find((q) => q.questionText.toLowerCase().includes('sponsorship'));
    expect(sponsorshipQuestion?.isSensitive).toBe(true);

    // 4. Answer every pending question — the last answer flips the status.
    for (const question of pendingQuestions) {
      const res = await request(app)
        .post(`/v1/applications/${applicationId}/questions/${question.id}/answer`)
        .set('Authorization', `Bearer ${token}`)
        .send({ answer: 'Test answer' });
      expect(res.status).toBe(202);
    }
    const afterAnswers = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(afterAnswers.status).toBe('awaiting_review');

    // 5. Confirm -> handed_off.
    const confirm = await request(app)
      .post(`/v1/applications/${applicationId}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(202);
    expect(confirm.body.status).toBe('handed_off');
    expect(confirm.body.employerApplyUrl).toBe(posting.employerApplyUrl);

    // 6. User reports they submitted it themselves -> applied.
    const complete = await request(app)
      .post(`/v1/applications/${applicationId}/handoff-complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(complete.status).toBe(200);
    expect(complete.body.status).toBe('applied');
  }, 30_000);

  it('queued -> awaiting_review directly when there are no pending questions', async () => {
    // No employerApplyUrl at all -> prepareHandoff returns an empty
    // sheet immediately (handoff.ts), no fetch calls, no pending questions.
    const { token } = await authedProfile();
    const posting = await prisma.jobPosting.create({
      data: {
        sourceProvider: 'yourator',
        externalRef: `apply-flow-noURL-${Date.now()}`,
        employerApplyUrl: null,
        title: 'Frontend Engineer',
        employer: 'SomeCo',
        requirementsSummary: '',
        language: 'en',
        market: 'TW',
        applyRoute: 'handoff',
      },
    });

    const swipe = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    const applicationId = swipe.body.application.id;

    const queuedJob = await prisma.queueJob.findFirst({ where: { type: 'submit' }, orderBy: { createdAt: 'desc' } });
    await handleSubmit(queuedJob!.payload);

    const application = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
    expect(application.status).toBe('awaiting_review');

    await prisma.jobPosting.delete({ where: { id: posting.id } });
  });
});
