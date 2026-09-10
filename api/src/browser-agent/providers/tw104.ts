import type { BrowserContext } from 'playwright';
import { SelectorNotFoundError } from '../errors.js';
import type { BrowserSubmitProvider } from './types.js';

// Deliberately deferred, not just unverified: 104.com.tw already has an
// active bot wall on its read side (see the 2026-09-10 risk-acceptance-log
// entry — its Apify scraper needs Playwright/Patchright stealth just to
// read listings). Automating a real submit click there compounds that
// already-flagged risk with the DOM-verification work jobsdb-hk.ts needs
// first. Per the phased plan, this stays a stub until jobsdb-hk.ts is
// verified end-to-end — see that file for the verification steps this
// one will need too, plus the stealth-mode question this provider adds
// on top.
export const tw104Provider: BrowserSubmitProvider = {
  name: 'tw104',
  async submit(_context: BrowserContext, posting: { employerApplyUrl: string }): Promise<void> {
    void posting;
    throw new SelectorNotFoundError('tw104 apply flow is deferred until jobsdb-hk.ts is verified — see module comment');
  },
};
