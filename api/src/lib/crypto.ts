import { createHash, randomBytes, randomInt } from 'node:crypto';

// ponytail: node:crypto only. No bcrypt/argon2 — these are short-lived,
// high-entropy, server-generated secrets (a 6-digit code, a 256-bit token),
// not user-chosen passwords, so a salted hash isn't needed to resist
// offline guessing; sha256 is enough to avoid storing the secret itself.
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function generateOneTimeCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateBearerToken(): string {
  return randomBytes(32).toString('base64url');
}
