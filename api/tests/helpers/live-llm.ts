import { isTransientLlmError } from '../../src/llm/client.js';

/**
 * The dev model is a free-tier one whose concurrency pool is shared with
 * every other user of the provider, and it periodically answers
 * `ResourceExhausted: Worker local total request limit reached (16/16)`
 * even after `llm/client.ts` has spent its whole retry budget waiting. That
 * is the vendor being full, which is not what a live test is for — these
 * tests assert our prompt, our parsing and our YoE precedence.
 *
 * So a *transient* failure ends the test with a loud warning rather than a
 * red build. Anything else — a bad prompt, an unparseable response, a wrong
 * YoE — still fails, which is the whole point of having them.
 */
export async function skippingProviderCapacity(body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (error) {
    if (!isTransientLlmError(error)) throw error;
    console.warn(`SKIPPED (provider at capacity, not a code defect): ${(error as Error).message}`);
  }
}
