import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const FIXED_CODE = '424242';

jest.unstable_mockModule('../../src/lib/crypto.js', () => ({
  hashSecret: (secret: string) => createHash('sha256').update(secret).digest('hex'),
  generateBearerToken: () => randomBytes(32).toString('base64url'),
  generateOneTimeCode: () => FIXED_CODE,
}));

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/lib/prisma.js');
const { config } = await import('../../src/config/index.js');
const { handleParseCv } = await import('../../src/queue/parse-cv.js');

const app = createApp();

function fixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`../unit/fixtures/${name}`, import.meta.url)));
}

async function authedRequest() {
  const email = `test-intake-${Date.now()}@example.com`;
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return verify.body.token as string;
}

const hasLiveKey = Boolean(config.openaiApiKey && config.openaiBaseUrl && config.llmModel);
const maybeIt = hasLiveKey ? it : it.skip;

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-intake-' } } });
  await rm(config.cvStorageDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('Full CV intake journey — upload through worker processing to profile confirmation', () => {
  maybeIt(
    'goes from an uploaded PDF to keywords/YoE the user can review and confirm',
    async () => {
      const token = await authedRequest();

      // 1. Upload — synchronous validation passes, parsing is queued (FR-001/FR-002).
      const uploadRes = await request(app)
        .post('/v1/profile/cv')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', fixture('sample-cv.pdf'), 'sample-cv.pdf');
      expect(uploadRes.status).toBe(202);
      expect(uploadRes.body.parseStatus).toBe('parsing');

      const queuedJob = await prisma.queueJob.findFirst({
        where: { type: 'parse_cv' },
        orderBy: { createdAt: 'desc' },
      });
      expect(queuedJob).not.toBeNull();

      // 2. Run the worker's handler directly (real code path, no polling
      // loop needed in a test — startWorkerLoop is just a setInterval
      // wrapper around the same claim-and-run logic exercised elsewhere).
      await handleParseCv(queuedJob!.payload);

      // 3. The raw extraction is available for review (FR-003) — not yet
      // applied to the profile.
      const cvRes = await request(app).get('/v1/profile/cv').set('Authorization', `Bearer ${token}`);
      expect(cvRes.body.parseStatus).toBe('succeeded');
      expect(cvRes.body.rawExtractedKeywords.length).toBeGreaterThan(0);
      expect(cvRes.body.rawExtractedYoe).toBe(5);

      const profileBefore = await request(app).get('/v1/profile').set('Authorization', `Bearer ${token}`);
      expect(profileBefore.body.keywords).toEqual([]); // never applied silently

      // 4. User confirms (possibly edited) values via PATCH.
      const confirmRes = await request(app)
        .patch('/v1/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ keywords: cvRes.body.rawExtractedKeywords, yoe: cvRes.body.rawExtractedYoe });
      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.yoe).toBe(5);
      expect(confirmRes.body.keywords.length).toBeGreaterThan(0);
    },
    90_000,
  );

  it('marks parseStatus failed rather than leaving it stuck on "parsing" when the worker hits an error', async () => {
    const token = await authedRequest();
    const uploadRes = await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixture('sample-cv.pdf'), 'sample-cv.pdf');

    // Corrupt the stored ref so the worker's retrieveCv() call fails,
    // simulating any downstream failure without needing a live LLM.
    await prisma.cvDocument.update({
      where: { id: uploadRes.body.id },
      data: { storageRef: 'this-ref-does-not-exist' },
    });

    const queuedJob = await prisma.queueJob.findFirst({
      where: { type: 'parse_cv' },
      orderBy: { createdAt: 'desc' },
    });
    await expect(handleParseCv(queuedJob!.payload)).rejects.toThrow();

    const doc = await prisma.cvDocument.findUnique({ where: { id: uploadRes.body.id } });
    expect(doc?.parseStatus).toBe('failed');
  });
});
