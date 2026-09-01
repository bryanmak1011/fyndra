import { randomBytes } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { deleteCv, retrieveCv, storeCv } from '../../src/cv/storage.js';
import { config } from '../../src/config/index.js';

describe('CV storage', () => {
  afterAll(async () => {
    await rm(config.cvStorageDir, { recursive: true, force: true });
  });

  it('round-trips real content through encrypt/store/retrieve/decrypt', async () => {
    const original = Buffer.from('This is a CV. It contains PII like a name and phone number.');
    const ref = await storeCv(original);
    const retrieved = await retrieveCv(ref);
    expect(retrieved.equals(original)).toBe(true);
  });

  it('round-trips binary content (a real PDF), not just text', async () => {
    const original = randomBytes(4096); // stand-in for arbitrary binary bytes
    const ref = await storeCv(original);
    const retrieved = await retrieveCv(ref);
    expect(retrieved.equals(original)).toBe(true);
  });

  it('never writes plaintext to disk — the stored file does not contain the original bytes', async () => {
    const original = Buffer.from('FINDABLE_PLAINTEXT_MARKER_STRING');
    const ref = await storeCv(original);
    const onDisk = await readFile(`${config.cvStorageDir}/${ref}.enc`);
    expect(onDisk.includes('FINDABLE_PLAINTEXT_MARKER_STRING')).toBe(false);
  });

  it('deletes in one operation — a deleted ref can no longer be retrieved', async () => {
    const ref = await storeCv(Buffer.from('to be deleted'));
    await deleteCv(ref);
    await expect(retrieveCv(ref)).rejects.toThrow();
  });

  it('deleting a ref that was never stored does not throw (idempotent)', async () => {
    await expect(deleteCv('00000000-0000-0000-0000-000000000000')).resolves.not.toThrow();
  });

  it('two different CVs get two different storage refs and neither leaks into the other', async () => {
    const refA = await storeCv(Buffer.from('CV A content'));
    const refB = await storeCv(Buffer.from('CV B content'));
    expect(refA).not.toBe(refB);
    expect((await retrieveCv(refA)).toString()).toBe('CV A content');
    expect((await retrieveCv(refB)).toString()).toBe('CV B content');
  });
});
