import type { SubmissionAttemptOutcome } from '@prisma/client';

// Every provider driver step must raise one of these (never a bare Error)
// so attemptBrowserSubmit can map it to a specific SubmissionAttemptOutcome
// and a specific Application.failureReason — see index.ts. This is the
// concrete mechanism behind "auto-submit never degrades into submitting to
// an unrecognised form" (data-model.md): no failure mode is allowed to
// fall through as a generic, unclassified error.

export abstract class BrowserSubmitError extends Error {
  abstract readonly outcome: SubmissionAttemptOutcome;
  abstract readonly failureReason: string;
}

export class SelectorNotFoundError extends BrowserSubmitError {
  readonly outcome = 'failed_selector' as const;
  readonly failureReason = 'selector_not_found';
  constructor(selectorDescription: string) {
    super(`Expected element not found: ${selectorDescription} — the site's DOM likely changed`);
  }
}

export class BotWallDetectedError extends BrowserSubmitError {
  readonly outcome = 'failed_bot_wall' as const;
  readonly failureReason = 'bot_wall';
  constructor(detail: string) {
    super(`Bot-detection wall encountered: ${detail}`);
  }
}

export class CaptchaEncounteredError extends BrowserSubmitError {
  readonly outcome = 'failed_captcha' as const;
  readonly failureReason = 'captcha';
  constructor() {
    super('A CAPTCHA was presented — not solved, attempt stopped');
  }
}

export class SessionExpiredError extends BrowserSubmitError {
  readonly outcome = 'failed_session_expired' as const;
  readonly failureReason = 'session_expired';
  constructor(provider: string) {
    super(
      `Stored session for ${provider} is no longer authenticated — re-run ` +
        `\`npm run capture-session -- --provider ${provider}\` to log in again`,
    );
  }
}

export function toBrowserSubmitError(err: unknown): BrowserSubmitError {
  if (err instanceof BrowserSubmitError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new UnknownBrowserSubmitError(message);
}

class UnknownBrowserSubmitError extends BrowserSubmitError {
  readonly outcome = 'failed_unknown' as const;
  readonly failureReason = 'site_error';
  constructor(message: string) {
    super(message);
  }
}
