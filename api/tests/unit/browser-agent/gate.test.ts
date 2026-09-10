import { isBrowserAutomationAllowed } from '../../../src/browser-agent/gate.js';
import { config } from '../../../src/config/index.js';

// Personal-test scope enforcement (compliance/risk-acceptance-log.md's
// 2026-09-10 entry) — must default closed, and must require both an
// explicit opt-in AND an exact profile match, not just one or the other.
describe('isBrowserAutomationAllowed', () => {
  const original = {
    browserAutomationEnabled: config.browserAutomationEnabled,
    browserAutomationTestProfileId: config.browserAutomationTestProfileId,
  };

  afterEach(() => {
    config.browserAutomationEnabled = original.browserAutomationEnabled;
    config.browserAutomationTestProfileId = original.browserAutomationTestProfileId;
  });

  it('denies when the feature is disabled, even for the configured test profile', () => {
    config.browserAutomationEnabled = false;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(isBrowserAutomationAllowed('profile-1')).toBe(false);
  });

  it('denies when enabled but no test profile is configured', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = '';
    expect(isBrowserAutomationAllowed('profile-1')).toBe(false);
  });

  it('denies a different profile than the configured test profile', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(isBrowserAutomationAllowed('someone-else')).toBe(false);
  });

  it('allows only the exact configured test profile when enabled', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(isBrowserAutomationAllowed('profile-1')).toBe(true);
  });
});
