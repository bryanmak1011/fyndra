import type { BrowserContext } from 'playwright';
import { SelectorNotFoundError } from '../errors.js';
import type { BrowserSubmitProvider } from './types.js';

// NOT YET VERIFIED — deliberately left unimplemented rather than guessed.
//
// The project's own constitution (Principle VI) is explicit: no code that
// takes a real-world, side-effecting action against an external site may
// be written from an assumed/guessed request shape — its actual
// request/response (here: DOM structure) shape must be confirmed live
// first. That's a stronger bar than the read-only scraping this repo
// already does, because a wrong guess here doesn't just fail to fetch
// data — it can click something unintended on a live application.
//
// To fill this in for real:
//   1. `npm run capture-session -- --provider jobsdb-hk` (headed browser,
//      log into your own JobsDB HK account by hand).
//   2. Set BROWSER_AUTOMATION_HEADLESS=false in .env, then run the worker
//      against one real swiped JobsDB HK application and watch what the
//      actual apply page looks like — the "Quick Apply" / "Apply Now"
//      selector, whether extra questions appear inline or in a follow-up
//      step, and what the confirmation state looks like (text, URL
//      change, or both).
//   3. Replace the body of `submit` below with the real click sequence,
//      keeping every failure path routed through the typed errors in
//      ../errors.ts (a missing/changed selector -> SelectorNotFoundError,
//      a bot-check interstitial -> BotWallDetectedError, a CAPTCHA
//      widget -> CaptchaEncounteredError) so attemptBrowserSubmit's
//      failure handling in ../index.ts keeps working unchanged.
export const jobsdbHkProvider: BrowserSubmitProvider = {
  name: 'jobsdb-hk',
  async submit(_context: BrowserContext, posting: { employerApplyUrl: string }): Promise<void> {
    void posting;
    throw new SelectorNotFoundError(
      'jobsdb-hk apply flow is not yet implemented — see the module comment in ' +
        'src/browser-agent/providers/jobsdb-hk.ts for how to verify and fill it in',
    );
  },
};
