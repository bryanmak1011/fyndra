// The real module — every other test file mocks this one out (to drive
// deterministic auth codes), so it had zero direct coverage of its own
// until this file. Auth security rests on these three functions, so they
// deserve real tests, not just an assumption they're correct.
import { generateBearerToken, generateOneTimeCode, hashSecret } from '../../src/lib/crypto.js';

describe('hashSecret', () => {
  it('is deterministic: the same input always hashes the same', () => {
    expect(hashSecret('my-secret')).toBe(hashSecret('my-secret'));
  });

  it('produces different hashes for different input', () => {
    expect(hashSecret('a')).not.toBe(hashSecret('b'));
  });

  it('never returns the plaintext input itself', () => {
    expect(hashSecret('super-secret-token')).not.toBe('super-secret-token');
  });

  it('produces a 64-character lowercase hex string (SHA-256)', () => {
    expect(hashSecret('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('generateOneTimeCode', () => {
  it('always returns a 6-digit numeric string, zero-padded', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateOneTimeCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('produces varied output, not a constant (weak randomness would be a real auth bug)', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateOneTimeCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('generateBearerToken', () => {
  it('returns a base64url string with no padding characters', () => {
    const token = generateBearerToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('has enough length to reflect 256 bits of entropy (32 raw bytes, base64url)', () => {
    // 32 bytes -> 43 base64url chars with no padding.
    expect(generateBearerToken().length).toBe(43);
  });

  it('generates a different token every call', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateBearerToken()));
    expect(tokens.size).toBe(20);
  });
});
