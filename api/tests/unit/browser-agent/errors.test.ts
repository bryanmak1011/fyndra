import {
  BotWallDetectedError,
  CaptchaEncounteredError,
  SelectorNotFoundError,
  SessionExpiredError,
  toBrowserSubmitError,
} from '../../../src/browser-agent/errors.js';

// attemptBrowserSubmit (index.ts) relies on every provider failure being
// one of these typed errors, each mapped to a specific
// SubmissionAttemptOutcome/failureReason — this is what guarantees no
// failure mode falls through unclassified (data-model.md's "never
// degrades into submitting to an unrecognised form" invariant).
describe('browser-agent typed errors', () => {
  it('maps each typed error to its own outcome and failureReason', () => {
    expect(new SelectorNotFoundError('apply button').outcome).toBe('failed_selector');
    expect(new SelectorNotFoundError('apply button').failureReason).toBe('selector_not_found');

    expect(new BotWallDetectedError('cloudflare interstitial').outcome).toBe('failed_bot_wall');
    expect(new BotWallDetectedError('cloudflare interstitial').failureReason).toBe('bot_wall');

    expect(new CaptchaEncounteredError().outcome).toBe('failed_captcha');
    expect(new CaptchaEncounteredError().failureReason).toBe('captcha');

    expect(new SessionExpiredError('jobsdb-hk').outcome).toBe('failed_session_expired');
    expect(new SessionExpiredError('jobsdb-hk').failureReason).toBe('session_expired');
  });

  it('passes a typed error through toBrowserSubmitError unchanged', () => {
    const original = new SelectorNotFoundError('apply button');
    expect(toBrowserSubmitError(original)).toBe(original);
  });

  it('wraps a bare Error as failed_unknown / site_error rather than dropping it', () => {
    const wrapped = toBrowserSubmitError(new Error('page.click: Target closed'));
    expect(wrapped.outcome).toBe('failed_unknown');
    expect(wrapped.failureReason).toBe('site_error');
    expect(wrapped.message).toBe('page.click: Target closed');
  });

  it('wraps a non-Error throw (e.g. a string) without throwing itself', () => {
    const wrapped = toBrowserSubmitError('something went wrong');
    expect(wrapped.outcome).toBe('failed_unknown');
    expect(wrapped.message).toBe('something went wrong');
  });
});
