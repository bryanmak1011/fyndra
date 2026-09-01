import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';

const FIXED_CODE = '424242';

jest.unstable_mockModule('../../src/lib/crypto.js', () => ({
  hashSecret: (secret: string) => createHash('sha256').update(secret).digest('hex'),
  generateBearerToken: () => randomBytes(32).toString('base64url'),
  generateOneTimeCode: () => FIXED_CODE,
}));

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/lib/prisma.js');

const app = createApp();

async function authedProfile() {
  const email = `test-apps-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return { token: verify.body.token as string, profileId: verify.body.profile.id as string };
}

async function seedApplication(profileId: string, status: string) {
  const posting = await prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-apps-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      employerApplyUrl: 'https://job-boards.greenhouse.io/testco/jobs/999',
      title: 'Backend Engineer',
      employer: 'TestCo',
      requirementsSummary: '',
      language: 'en',
      market: 'HK',
      applyRoute: 'handoff',
    },
  });
  const interaction = await prisma.jobInteraction.create({
    data: { profileId, jobPostingId: posting.id, direction: 'right' },
  });
  return prisma.application.create({
    data: {
      jobInteractionId: interaction.id,
      submissionMode: 'review_before_sending',
      applyRoute: 'handoff',
      employerApplyUrl: posting.employerApplyUrl,
      status,
    },
  });
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-apps-seed' } });
});

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-apps-' } } });
  await prisma.$disconnect();
});

describe('POST /v1/applications/{id}/confirm', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/v1/applications/00000000-0000-0000-0000-000000000000/confirm').send({});
    expect(res.status).toBe(401);
  });

  it('returns 404 for an application belonging to a different profile', async () => {
    const { token } = await authedProfile();
    const { profileId: otherProfileId } = await authedProfile();
    const application = await seedApplication(otherProfileId, 'awaiting_review');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('rejects confirming an application not in awaiting_review', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'queued');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(409);
  });

  it('confirms an awaiting_review application, transitioning to handed_off (no real submit channel — BLOCKERS.md)', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'awaiting_review');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(202);
    expect(res.body.status).toBe('handed_off');
  });

  it('applies edited answers before confirming', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'awaiting_review');
    await prisma.proposedAnswer.create({
      data: { applicationId: application.id, fieldId: 'first_name', label: 'First Name', answer: 'Jane', source: 'generated' },
    });

    const res = await request(app)
      .post(`/v1/applications/${application.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({ editedAnswers: [{ fieldId: 'first_name', answer: 'Janet' }] });

    expect(res.status).toBe(202);
    expect(res.body.answerSheet[0]).toMatchObject({ fieldId: 'first_name', answer: 'Janet' });
  });
});

describe('POST /v1/applications/{id}/handoff-complete', () => {
  it('rejects a status other than handed_off', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'awaiting_review');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/handoff-complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });

  it('marks a handed_off application as applied', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'handed_off');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/handoff-complete`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('applied');
    expect(res.body.submittedAt).not.toBeNull();
  });
});

describe('POST /v1/applications/{id}/questions/{questionId}/answer', () => {
  it('answers a pending question and resumes to awaiting_review once all are answered', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'pending_needs_answer');
    const question = await prisma.applicationQuestion.create({
      data: {
        applicationId: application.id,
        profileId,
        questionText: 'Favorite language?',
        questionFingerprint: 'fp1',
        isSensitive: false,
      },
    });

    const res = await request(app)
      .post(`/v1/applications/${application.id}/questions/${question.id}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'TypeScript' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('awaiting_review');
    expect(res.body.pendingQuestions).toHaveLength(0);
  });

  it('stays pending_needs_answer while other questions remain unanswered', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'pending_needs_answer');
    const q1 = await prisma.applicationQuestion.create({
      data: { applicationId: application.id, profileId, questionText: 'Q1', questionFingerprint: 'fp-q1', isSensitive: false },
    });
    await prisma.applicationQuestion.create({
      data: { applicationId: application.id, profileId, questionText: 'Q2', questionFingerprint: 'fp-q2', isSensitive: false },
    });

    const res = await request(app)
      .post(`/v1/applications/${application.id}/questions/${q1.id}/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'Answer 1' });

    expect(res.status).toBe(202);
    expect(res.body.status).toBe('pending_needs_answer');
    expect(res.body.pendingQuestions).toHaveLength(1);
  });

  it('returns 404 for a question that does not belong to the application', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'pending_needs_answer');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/questions/00000000-0000-0000-0000-000000000000/answer`)
      .set('Authorization', `Bearer ${token}`)
      .send({ answer: 'x' });
    expect(res.status).toBe(404);
  });
});
