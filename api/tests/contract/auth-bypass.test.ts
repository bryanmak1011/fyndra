import { jest } from '@jest/globals';
import { createHash, randomBytes } from 'node:crypto';

const FIXED_CODE = '424242';
const BYPASS_EMAIL = 'test-bypass-abc123@abcai.com';

// Set before importing config: `config.authBypassEmails` is read once at
// module load. Hard-coded here rather than read from .env so the test
// asserts the mechanism, not whatever the current machine happens to have
// configured.
process.env.AUTH_BYPASS_EMAILS = BYPASS_EMAIL;

jest.unstable_mockModule('../../src/lib/crypto.js', () => ({
  hashSecret: (secret: string) => createHash('sha256').update(secret).digest('hex'),
  generateBearerToken: () => randomBytes(32).toString('base64url'),
  generateOneTimeCode: () => FIXED_CODE,
}));

const request = (await import('supertest')).default;
const { createApp } = await import('../../src/app.js');
const { prisma } = await import('../../src/lib/prisma.js');

const app = createApp();

afterAll(async () => {
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-bypass-' } } });
  await prisma.$disconnect();
});

describe('one-time-code bypass for configured test accounts', () => {
  it('returns a usable session straight from request-code, with no code step', async () => {
    const res = await request(app).post('/v1/auth/request-code').send({ email: BYPASS_EMAIL });

    expect(res.status).toBe(202);
    expect(res.body.session?.token).toEqual(expect.any(String));
    expect(res.body.session?.profile?.email).toBe(BYPASS_EMAIL);

    // The token is a real one, not a placeholder: it has to authenticate a
    // protected route.
    const authed = await request(app)
      .post('/v1/devices')
      .set('Authorization', `Bearer ${res.body.session.token}`)
      .send({ pushToken: 'device-token-bypass', platform: 'apns' });
    expect(authed.status).toBe(204);
  });

  it('matches the address case-insensitively', async () => {
    const res = await request(app)
      .post('/v1/auth/request-code')
      .send({ email: BYPASS_EMAIL.toUpperCase() });
    expect(res.body.session?.token).toEqual(expect.any(String));
  });

  it('never writes a one-time code for a bypass account', async () => {
    await request(app).post('/v1/auth/request-code').send({ email: BYPASS_EMAIL });

    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { email: BYPASS_EMAIL } });
    const codes = await prisma.authCode.count({ where: { profileId: profile.id } });
    expect(codes).toBe(0);
  });

  // The rest of this suite is the part that matters: everyone else must be
  // completely unaffected.
  it('gives an ordinary account no session and no way to tell the difference', async () => {
    const ordinary = `test-bypass-ordinary-${Date.now()}@example.com`;
    const res = await request(app).post('/v1/auth/request-code').send({ email: ordinary });

    expect(res.status).toBe(202);
    expect(res.body.session).toBeUndefined();
    expect(res.body).toEqual({});
  });

  it('still requires a correct code for an ordinary account', async () => {
    const ordinary = `test-bypass-ordinary-${Date.now()}-b@example.com`;
    await request(app).post('/v1/auth/request-code').send({ email: ordinary });

    const wrong = await request(app).post('/v1/auth/verify').send({ email: ordinary, code: '000000' });
    expect(wrong.status).toBe(401);

    const right = await request(app).post('/v1/auth/verify').send({ email: ordinary, code: FIXED_CODE });
    expect(right.status).toBe(200);
  });

  it('does not let a near-miss address slip through', async () => {
    for (const lookalike of [
      'abc123@abcai.com.evil.test',
      'xabc123@abcai.com',
      `${BYPASS_EMAIL}.evil.test`,
    ]) {
      const res = await request(app).post('/v1/auth/request-code').send({ email: lookalike });
      expect(res.body.session).toBeUndefined();
      await prisma.userProfile.deleteMany({ where: { email: lookalike } });
    }
  });
});
