import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';

const FIXED_CODE = '424242';

// Same approach as tests/contract/auth.test.ts — see that file's comment
// for why this reimplements hashSecret/generateBearerToken rather than
// importing the real module from inside the mock factory.
jest.unstable_mockModule('../../src/lib/crypto.js', () => ({
  hashSecret: (secret: string) => createHash('sha256').update(secret).digest('hex'),
  generateBearerToken: () => randomBytes(32).toString('base64url'),
  generateOneTimeCode: () => FIXED_CODE,
}));

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/lib/prisma.js');
const { config } = await import('../../src/config/index.js');

const app = createApp();
let counter = 0;
const freshEmail = () => `test-profile-${Date.now()}-${counter++}@example.com`;

function fixture(name: string): Buffer {
  return readFileSync(fileURLToPath(new URL(`../unit/fixtures/${name}`, import.meta.url)));
}

async function authedRequest() {
  const email = freshEmail();
  await request(app).post('/v1/auth/request-code').send({ email });
  const verify = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return verify.body.token as string;
}

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-profile-' } } });
  await rm(config.cvStorageDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('POST /v1/profile/cv', () => {
  it('rejects an unsupported file with 422 unsupported_format', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('not a real cv'), 'notes.txt');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('unsupported_format');
  });

  it('rejects a PDF with no text layer with 422 no_text_layer', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixture('blank.pdf'), 'blank.pdf');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('no_text_layer');
  });

  it('accepts a real text-layer PDF, stores it, and queues parsing', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixture('sample-cv.pdf'), 'sample-cv.pdf');

    expect(res.status).toBe(202);
    expect(res.body.fileFormat).toBe('pdf');
    expect(res.body.parseStatus).toBe('parsing');

    const stored = await prisma.cvDocument.findUnique({ where: { id: res.body.id } });
    expect(stored).not.toBeNull();
    const queued = await prisma.queueJob.findFirst({ where: { type: 'parse_cv' } });
    expect(queued).not.toBeNull();
  });

  it('accepts a real DOCX', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixture('sample-cv.docx'), 'sample-cv.docx');
    expect(res.status).toBe(202);
    expect(res.body.fileFormat).toBe('docx');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/v1/profile/cv').attach('file', fixture('blank.pdf'), 'blank.pdf');
    expect(res.status).toBe(401);
  });
});

describe('GET /v1/profile/cv', () => {
  it('returns 404 when nothing has been uploaded yet', async () => {
    const token = await authedRequest();
    const res = await request(app).get('/v1/profile/cv').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns the most recent upload after one exists', async () => {
    const token = await authedRequest();
    await request(app)
      .post('/v1/profile/cv')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', fixture('sample-cv.pdf'), 'sample-cv.pdf');

    const res = await request(app).get('/v1/profile/cv').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fileFormat).toBe('pdf');
  });
});

describe('GET/PATCH /v1/profile', () => {
  it('returns the default profile shape for a new user', async () => {
    const token = await authedRequest();
    const res = await request(app).get('/v1/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.submissionMode).toBe('review_before_sending');
    expect(res.body.dailySubmissionCap).toBe(15); // compliance/volume-policy.md default
    expect(res.body.submissionsUsedToday).toBe(0);
  });

  it('applies a user correction (FR-003) — raw extraction is never applied silently', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .patch('/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ yoe: 6, keywords: ['TypeScript', 'PostgreSQL'], preferredLanguage: 'zh-Hant' });

    expect(res.status).toBe(200);
    expect(res.body.yoe).toBe(6);
    expect(res.body.keywords).toEqual(['TypeScript', 'PostgreSQL']);
    expect(res.body.preferredLanguage).toBe('zh-Hant');

    const getRes = await request(app).get('/v1/profile').set('Authorization', `Bearer ${token}`);
    expect(getRes.body.yoe).toBe(6);
  });

  it('rejects an invalid submissionMode value', async () => {
    const token = await authedRequest();
    const res = await request(app)
      .patch('/v1/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ submissionMode: 'not_a_real_mode' });
    expect(res.status).toBe(400);
  });
});
