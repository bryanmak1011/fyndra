import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';

// Proof a submission actually happened, since this path (unlike handoff)
// has no user self-report to fall back on — the screenshot + final URL
// are what an Application.status: auto_submitted claim is backed by.
// Plaintext, not encrypted like session.ts: a confirmation-page
// screenshot isn't the same sensitivity class as a live session cookie.

const EVIDENCE_DIR = join('data', 'submission-evidence');

export async function captureEvidence(
  page: Page,
  attemptId: string,
): Promise<{ screenshotPath: string; finalUrl: string }> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  const screenshotPath = join(EVIDENCE_DIR, `${attemptId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return { screenshotPath, finalUrl: page.url() };
}
