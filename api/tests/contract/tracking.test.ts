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
  const email = `test-tracking-${Date.now()}-${Math.random()}@example.com`;
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return { token: verify.body.token as string, profileId: verify.body.profile.id as string };
}

async function seedApplication(profileId: string, status: string) {
  const posting = await prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-tracking-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
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
  const application = await prisma.application.create({
    data: { jobInteractionId: interaction.id, submissionMode: 'review_before_sending', applyRoute: 'handoff', status },
  });
  await prisma.applicationStatusEvent.create({ data: { applicationId: application.id, status } });
  return application;
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-tracking-seed' } });
});

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-tracking-' } } });
  await prisma.$disconnect();
});

describe('GET /v1/applications', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/v1/applications');
    expect(res.status).toBe(401);
  });

  it('lists only the authenticated profile\'s applications', async () => {
    const { token, profileId } = await authedProfile();
    const { profileId: otherProfileId } = await authedProfile();
    await seedApplication(profileId, 'applied');
    await seedApplication(otherProfileId, 'applied');

    const res = await request(app).get('/v1/applications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filters by status', async () => {
    const { token, profileId } = await authedProfile();
    await seedApplication(profileId, 'applied');
    await seedApplication(profileId, 'rejected');

    const res = await request(app)
      .get('/v1/applications')
      .query({ status: 'rejected' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('rejected');
  });
});

describe('GET /v1/applications/{id}', () => {
  it('returns 404 for another profile\'s application', async () => {
    const { token } = await authedProfile();
    const { profileId: otherProfileId } = await authedProfile();
    const application = await seedApplication(otherProfileId, 'applied');

    const res = await request(app)
      .get(`/v1/applications/${application.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('includes status history', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'applied');

    const res = await request(app)
      .get(`/v1/applications/${application.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.statusHistory).toHaveLength(1);
    expect(res.body.statusHistory[0].status).toBe('applied');
  });
});

describe('POST /v1/applications/{id}/status', () => {
  it('allows a legal transition and appends a status event', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'applied');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'responded' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('responded');

    const detail = await request(app)
      .get(`/v1/applications/${application.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.body.statusHistory).toHaveLength(2);
  });

  it('rejects an illegal transition (hired from queued) with 409', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'queued');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'hired' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('invalid_transition');
  });

  it('rejects skipping a stage (interview from applied)', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'applied');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'interview' });

    expect(res.status).toBe(409);
  });

  it('rejects an unknown status value', async () => {
    const { token, profileId } = await authedProfile();
    const application = await seedApplication(profileId, 'applied');

    const res = await request(app)
      .post(`/v1/applications/${application.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'not_a_real_status' });

    expect(res.status).toBe(400);
  });
});
