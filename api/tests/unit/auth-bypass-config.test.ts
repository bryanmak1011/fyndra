import { loadAuthBypassEmails } from '../../src/config/index.js';

// AUTH_BYPASS_EMAILS disables one-time-code verification for the listed
// accounts. These tests exist to keep it from ever being shippable, so they
// are deliberately blunt about the failure mode rather than just covering
// the happy path.
describe('loadAuthBypassEmails', () => {
  it('is empty when the variable is unset — no environment bypasses by default', () => {
    expect(loadAuthBypassEmails({})).toEqual([]);
    expect(loadAuthBypassEmails({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('is empty for a blank or whitespace-only value', () => {
    expect(loadAuthBypassEmails({ AUTH_BYPASS_EMAILS: '' })).toEqual([]);
    expect(loadAuthBypassEmails({ AUTH_BYPASS_EMAILS: '   ' })).toEqual([]);
  });

  it('REFUSES TO START when set in production, rather than silently ignoring it', () => {
    // A silent no-op would leave the variable sitting in a production
    // environment looking harmless until someone relaxes the check.
    expect(() =>
      loadAuthBypassEmails({ NODE_ENV: 'production', AUTH_BYPASS_EMAILS: 'abc123@abcai.com' }),
    ).toThrow(/production/i);
  });

  it('parses a comma-separated list, trimming and lower-casing each address', () => {
    expect(
      loadAuthBypassEmails({
        NODE_ENV: 'development',
        AUTH_BYPASS_EMAILS: ' ABC123@abcai.com , second@abcai.com ,, ',
      }),
    ).toEqual(['abc123@abcai.com', 'second@abcai.com']);
  });

  it('treats an unset NODE_ENV as non-production, matching config.nodeEnv default', () => {
    expect(loadAuthBypassEmails({ AUTH_BYPASS_EMAILS: 'abc123@abcai.com' })).toEqual([
      'abc123@abcai.com',
    ]);
  });
});
