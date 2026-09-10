import { rm } from 'node:fs/promises';
import { loadSessionState, saveSessionState } from '../../../src/browser-agent/session.js';
import { config } from '../../../src/config/index.js';

function fakeContext(state: object) {
  return { storageState: async () => state } as unknown as Parameters<typeof saveSessionState>[1];
}

describe('browser-agent session state', () => {
  afterAll(async () => {
    await rm(config.sessionStateStorageDir, { recursive: true, force: true });
  });

  it('round-trips a captured storageState through encrypt/save/load/decrypt', async () => {
    const state = { cookies: [{ name: 'session', value: 'abc123' }], origins: [] };
    await saveSessionState('test-provider', fakeContext(state));
    const loaded = await loadSessionState('test-provider');
    expect(loaded).toEqual(state);
  });

  it('returns null for a provider that has never been captured', async () => {
    await expect(loadSessionState('never-captured-provider')).resolves.toBeNull();
  });

  it('never writes the plaintext session content to disk', async () => {
    const marker = 'FINDABLE_SESSION_TOKEN_MARKER';
    await saveSessionState('marker-provider', fakeContext({ cookies: [{ name: 'x', value: marker }], origins: [] }));
    const onDisk = await import('node:fs/promises').then((fs) =>
      fs.readFile(`${config.sessionStateStorageDir}/marker-provider.enc`),
    );
    expect(onDisk.includes(marker)).toBe(false);
  });

  it('keeps different providers isolated from each other', async () => {
    await saveSessionState('provider-a', fakeContext({ cookies: [{ name: 'a', value: '1' }], origins: [] }));
    await saveSessionState('provider-b', fakeContext({ cookies: [{ name: 'b', value: '2' }], origins: [] }));
    expect(await loadSessionState('provider-a')).toEqual({ cookies: [{ name: 'a', value: '1' }], origins: [] });
    expect(await loadSessionState('provider-b')).toEqual({ cookies: [{ name: 'b', value: '2' }], origins: [] });
  });
});
