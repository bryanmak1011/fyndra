import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BrowserContext } from 'playwright';
import { config } from '../config/index.js';

// Encrypted-at-rest storage for Playwright's `storageState` (cookies +
// localStorage) — deliberately never the account password, which is
// typed once by hand into the real login page during capture-session.ts
// and never seen by any Fyndra code. Mirrors cv/storage.ts's AES-256-GCM
// layout but under a separate key (sessionStateEncryptionKey): a leaked
// session-state key hands out a live authenticated session, a materially
// bigger blast radius than a leaked CV.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  if (!config.sessionStateEncryptionKey) {
    throw new Error('SESSION_STATE_ENCRYPTION_KEY is not set — required to store or read session state');
  }
  const key = Buffer.from(config.sessionStateEncryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error('SESSION_STATE_ENCRYPTION_KEY must be 32 bytes of hex (openssl rand -hex 32)');
  }
  return key;
}

function pathFor(provider: string): string {
  return join(config.sessionStateStorageDir, `${provider}.enc`);
}

/** Called once by capture-session.ts after a real, hand-typed login. */
export async function saveSessionState(provider: string, context: BrowserContext): Promise<void> {
  const state = await context.storageState();
  const plaintext = Buffer.from(JSON.stringify(state), 'utf8');

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  await mkdir(config.sessionStateStorageDir, { recursive: true });
  await writeFile(pathFor(provider), Buffer.concat([iv, authTag, ciphertext]));
}

/** Returns null if no session has been captured for this provider yet. */
export async function loadSessionState(provider: string): Promise<object | null> {
  let raw: Buffer;
  try {
    raw = await readFile(pathFor(provider));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
