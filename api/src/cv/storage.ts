import { randomBytes, randomUUID, createCipheriv, createDecipheriv } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config/index.js';

// PII-partitioned CV storage: encrypted at rest (AES-256-GCM), addressed
// by an opaque storageRef so CvDocument rows never carry a raw filesystem
// path, and deletable in one operation (compliance/privacy-policy-
// requirements.md §4 — "one-operation delete" was the explicit design
// goal so a retention sweep or a user's own deletion request can't leave
// partial state).
//
// ponytail: local filesystem, not S3 — Phase 1 runs on one machine
// (SDD.md §11.1). Swap the three functions below for an S3/GCS-backed
// implementation without touching any caller when that's actually needed.

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard nonce size

function encryptionKey(): Buffer {
  if (!config.cvEncryptionKey) {
    throw new Error('CV_ENCRYPTION_KEY is not set — required to store or read any CV');
  }
  const key = Buffer.from(config.cvEncryptionKey, 'hex');
  if (key.length !== 32) {
    throw new Error('CV_ENCRYPTION_KEY must be 32 bytes of hex (openssl rand -hex 32)');
  }
  return key;
}

function pathFor(storageRef: string): string {
  return join(config.cvStorageDir, `${storageRef}.enc`);
}

/** Encrypts `buf` and writes it under a new opaque ref; returns that ref. */
export async function storeCv(buf: Buffer): Promise<string> {
  const storageRef = randomUUID();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(buf), cipher.final()]);
  const authTag = cipher.getAuthTag();

  await mkdir(config.cvStorageDir, { recursive: true });
  // Layout: [iv (12)] [authTag (16)] [ciphertext (...)]
  await writeFile(pathFor(storageRef), Buffer.concat([iv, authTag, ciphertext]));
  return storageRef;
}

export async function retrieveCv(storageRef: string): Promise<Buffer> {
  const raw = await readFile(pathFor(storageRef));
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Single-operation delete — the design goal cited in the module comment above. */
export async function deleteCv(storageRef: string): Promise<void> {
  await rm(pathFor(storageRef), { force: true });
}
