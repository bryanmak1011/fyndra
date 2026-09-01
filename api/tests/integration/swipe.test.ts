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
  const email = `test-swipeflow-${Date.now()}@example.com`;
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return { token: verify.body.token as string, profileId: verify.body.profile.id as string };
}

async function seedPosting() {
  return prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-swipeflow-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      employerApplyUrl: `https://job-boards.greenhouse.io/testco/jobs/${Math.random()}`,
      title: 'Backend Engineer',
      employer: 'TestCo',
      requirementsSummary: 'Hong Kong',
      language: 'en',
      market: 'HK',
      applyRoute: 'direct_submit_allowlisted',
    },
  });
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-swipeflow-seed' } });
});

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-swipeflow-' } } });
  await prisma.$disconnect();
});

describe('Swipe → feed exclusion and idempotent re-swipe (FR-014)', () => {
  it('a swiped job never reappears in the feed, and re-swiping is idempotent', async () => {
    const { token, profileId } = await authedProfile();
    const posting = await seedPosting();
    await prisma.feedEntry.create({ data: { profileId, jobPostingId: posting.id, matchScore: 1 } });

    const before = await request(app).get('/v1/jobs/feed').set('Authorization', `Bearer ${token}`);
    expect(before.body.items.map((i: { id: string }) => i.id)).toContain(posting.id);

    const swipe = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    expect(swipe.status).toBe(202);
    const firstApplicationId = swipe.body.application.id;

    const after = await request(app).get('/v1/jobs/feed').set('Authorization', `Bearer ${token}`);
    expect(after.body.items.map((i: { id: string }) => i.id)).not.toContain(posting.id);

    // Re-swiping the same job (e.g. after reinstall) must not create a
    // second JobInteraction or a second Application — same one comes back.
    const reswipe = await request(app)
      .post(`/v1/jobs/${posting.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    expect(reswipe.status).toBe(202);
    expect(reswipe.body.application.id).toBe(firstApplicationId);

    const interactions = await prisma.jobInteraction.findMany({ where: { profileId, jobPostingId: posting.id } });
    expect(interactions).toHaveLength(1);
    const applications = await prisma.application.findMany({ where: { jobInteractionId: interactions[0].id } });
    expect(applications).toHaveLength(1);
  });

  it('enforces the daily submission cap at swipe time (FR-024)', async () => {
    const { token, profileId } = await authedProfile();
    await prisma.userProfile.update({ where: { id: profileId }, data: { dailySubmissionCap: 1 } });

    const first = await seedPosting();
    const second = await seedPosting();

    const firstSwipe = await request(app)
      .post(`/v1/jobs/${first.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    expect(firstSwipe.status).toBe(202);

    // Simulate that first application actually got submitted today, so
    // it counts against the cap (submissionsToday() only counts `applied`).
    await prisma.application.update({
      where: { jobInteractionId: firstSwipe.body.interactionId },
      data: { status: 'applied', submittedAt: new Date() },
    });

    const secondSwipe = await request(app)
      .post(`/v1/jobs/${second.id}/swipe`)
      .set('Authorization', `Bearer ${token}`)
      .send({ direction: 'right' });
    expect(secondSwipe.status).toBe(409);
    expect(secondSwipe.body.code).toBe('cap_reached');
  });
});
