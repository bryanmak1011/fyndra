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
let counter = 0;
const freshEmail = () => `test-feed-${Date.now()}-${counter++}@example.com`;

async function authedProfile() {
  const email = freshEmail();
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return { token: verify.body.token as string, profileId: verify.body.profile.id as string };
}

async function seedPosting(overrides: Partial<{ market: 'HK' | 'TW'; title: string; employer: string }> = {}) {
  return prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-feed-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      employerApplyUrl: `https://job-boards.greenhouse.io/testco/jobs/${Math.random()}`,
      title: overrides.title ?? 'Backend Engineer',
      employer: overrides.employer ?? 'TestCo',
      requirementsSummary: 'Hong Kong',
      language: 'en',
      market: overrides.market ?? 'HK',
      applyRoute: 'direct_submit_allowlisted',
    },
  });
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-feed-seed' } });
});

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-feed-' } } });
  await prisma.$disconnect();
});

describe('GET /v1/jobs/feed', () => {
  it('rejects an unauthenticated request', async () => {
    const res = await request(app).get('/v1/jobs/feed');
    expect(res.status).toBe(401);
  });

  it('returns an empty, exhausted feed for a profile with no matching FeedEntry rows', async () => {
    const { token } = await authedProfile();
    const res = await request(app).get('/v1/jobs/feed').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.exhausted).toBe(true);
  });

  it('returns ranked postings once FeedEntry rows exist, ordered by matchScore desc', async () => {
    const { token, profileId } = await authedProfile();
    const low = await seedPosting({ title: 'Sales Associate' });
    const high = await seedPosting({ title: 'Backend Engineer' });
    await prisma.feedEntry.createMany({
      data: [
        { profileId, jobPostingId: low.id, matchScore: 0.1 },
        { profileId, jobPostingId: high.id, matchScore: 0.9 },
      ],
    });

    const res = await request(app).get('/v1/jobs/feed').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].id).toBe(high.id);
    expect(res.body.items[1].id).toBe(low.id);
  });
});

describe('POST /v1/jobs/{jobId}/swipe', () => {
  it('returns 410 for a job that does not exist', async () => {
    const { token } = await authedProfile();
    const res = await request(app)
      .post('/v1/jobs/00000000-0000-0000-0000-000000000000/swipe')
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'left' });
    expect(res.status).toBe(410);
  });

  it('records a left swipe with no Application created', async () => {
    const { token } = await authedProfile();
    const posting = await seedPosting();
    const res = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'left' });

    expect(res.status).toBe(202);
    expect(res.body.direction).toBe('left');
    expect(res.body.application).toBeNull();
  });

  it('records a right swipe and immediately queues an Application (FR-023)', async () => {
    const { token } = await authedProfile();
    const posting = await seedPosting();
    const res = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });

    expect(res.status).toBe(202);
    expect(res.body.application).not.toBeNull();
    expect(res.body.application.status).toBe('queued');
    expect(res.body.application.applyRoute).toBe('direct_submit_allowlisted');
    // The swipe response is a complete tracking row, so the client can show
    // the new application without a refetch.
    expect(res.body.application.jobPostingId).toBe(posting.id);
    expect(res.body.application.jobTitle).toBe(posting.title);
    expect(res.body.application.employer).toBe(posting.employer);
  });

  it('rejects an invalid direction', async () => {
    const { token } = await authedProfile();
    const posting = await seedPosting();
    const res = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'up' });
    expect(res.status).toBe(400);
  });
});
