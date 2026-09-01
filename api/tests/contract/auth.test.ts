import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';

const FIXED_CODE = '424242';

// Mock only the code generator so this test can drive the real verify path
// end-to-end, without weakening code hashing in non-test code. hashSecret
// and generateBearerToken are re-implemented here (not re-exported from the
// real module) because ts-jest's ESM mode doesn't support importing the
// unmocked module from inside its own mock factory.
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
const freshEmail = () => `test-auth-${Date.now()}-${counter++}@example.com`;

async function verifiedToken(email: string): Promise<string> {
  await request(app).post('/v1/auth/request-code').send({ email });
  const res = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
  return res.body.token as string;
}

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-auth-' } } });
  await prisma.$disconnect();
});

describe('POST /v1/auth/request-code', () => {
  it('accepts a valid email and returns 202', async () => {
    const res = await request(app).post('/v1/auth/request-code').send({ email: freshEmail() });
    expect(res.status).toBe(202);
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app).post('/v1/auth/request-code').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /v1/auth/verify', () => {
  it('rejects an unknown code with 401', async () => {
    const res = await request(app)
      .post('/v1/auth/verify')
      .send({ email: freshEmail(), code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('invalid_code');
  });

  it('issues a bearer token for the correct code, and rejects reuse of the same code', async () => {
    const email = freshEmail();
    await request(app).post('/v1/auth/request-code').send({ email });

    const first = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
    expect(first.status).toBe(200);
    expect(typeof first.body.token).toBe('string');
    expect(first.body.profile.email).toBe(email);
    expect(first.body.profile.submissionMode).toBe('review_before_sending');

    const replay = await request(app).post('/v1/auth/verify').send({ email, code: FIXED_CODE });
    expect(replay.status).toBe(401);
  });
});

describe('GET /v1/health', () => {
  it('responds without auth', async () => {
    const res = await request(app).get('/v1/health');
    expect(res.status).toBe(200);
  });
});

describe('bearer auth', () => {
  it('rejects a protected route with no token', async () => {
    const res = await request(app).post('/v1/devices').send({ pushToken: 'x', platform: 'apns' });
    expect(res.status).toBe(401);
  });

  it('rejects a protected route with a garbage token', async () => {
    const res = await request(app)
      .post('/v1/devices')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ pushToken: 'x', platform: 'apns' });
    expect(res.status).toBe(401);
  });

  it('accepts a protected route with a real token', async () => {
    const token = await verifiedToken(freshEmail());
    const res = await request(app)
      .post('/v1/devices')
      .set('Authorization', `Bearer ${token}`)
      .send({ pushToken: 'device-token-1', platform: 'apns' });
    expect(res.status).toBe(204);
  });
});
