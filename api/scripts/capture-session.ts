// Standalone dev tool — NOT part of the server/worker runtime. Run by
// hand, once per provider, whenever a session needs (re)capturing:
//
//   npm run capture-session -- --provider jobsdb-hk
//
// Opens a real, headed browser at the provider's own home page. You log
// into your own account by hand, in that window — your password is typed
// directly into the real site and never touches any code in this repo.
// Once you're visibly logged in, press Enter here to capture and encrypt
// the resulting session (cookies + localStorage, not the password) to
// data/session-state/<provider>.enc. See src/browser-agent/session.ts.
try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { createInterface } from 'node:readline/promises';
import { chromium } from 'playwright';
import { saveSessionState } from '../src/browser-agent/session.js';

const PROVIDER_HOME_URL: Record<string, string> = {
  'jobsdb-hk': 'https://hk.jobsdb.com/',
  tw104: 'https://www.104.com.tw/',
};

function parseProvider(): string {
  const flagIndex = process.argv.indexOf('--provider');
  const provider = flagIndex !== -1 ? process.argv[flagIndex + 1] : undefined;
  if (!provider || !(provider in PROVIDER_HOME_URL)) {
    const known = Object.keys(PROVIDER_HOME_URL).join(', ');
    throw new Error(`Usage: npm run capture-session -- --provider <${known}>`);
  }
  return provider;
}

async function main(): Promise<void> {
  const provider = parseProvider();
  const homeUrl = PROVIDER_HOME_URL[provider];

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(homeUrl);

  console.log(`\nOpened ${homeUrl} in a real browser window.`);
  console.log(`Log into your own ${provider} account by hand in that window.`);
  console.log('Once you can see you are fully logged in (profile/dashboard visible),');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('press Enter here to capture the session... ');
  rl.close();

  await saveSessionState(provider, context);
  await browser.close();

  console.log(`\nSaved encrypted session state for "${provider}".`);
  console.log('Re-run this script any time browser-agent reports a session_expired failure.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
