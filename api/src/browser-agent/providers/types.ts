import type { BrowserContext } from 'playwright';

export interface ProposedAnswerLike {
  fieldId: string;
  label: string;
  answer: string;
}

export interface BrowserSubmitProvider {
  /** Matches Application.jobInteraction.jobPosting.sourceProvider. */
  readonly name: string;
  /**
   * Drives the real apply flow for one posting to completion. Must throw a
   * BrowserSubmitError subclass (see ../errors.ts) on any failure — never
   * resolve without either a confirmed submission or a thrown error, so
   * attemptBrowserSubmit (../index.ts) can never mistake "didn't error"
   * for "definitely submitted."
   */
  submit(
    context: BrowserContext,
    posting: { employerApplyUrl: string },
    answers: ProposedAnswerLike[],
  ): Promise<void>;
}
