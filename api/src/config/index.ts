function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/**
 * Accounts that may sign in without a one-time code. This is an
 * authentication bypass, so it is built to be impossible to ship rather
 * than merely switched off:
 *
 *  - it lives in the environment, never in source, so no address is baked
 *    into a build artifact;
 *  - `NODE_ENV=production` with the variable set **refuses to boot**. It is
 *    deliberately not "ignored in production": a silent no-op leaves the
 *    variable sitting in a production environment looking harmless, and the
 *    next person to relax this check ships a backdoor. A server that will
 *    not start is a problem someone fixes in minutes;
 *  - it is empty unless explicitly set, so the default posture of every
 *    environment — including a developer's — is no bypass at all.
 *
 * Exported for its own tests; `config.authBypassEmails` is the value the
 * app uses.
 */
export function loadAuthBypassEmails(env: NodeJS.ProcessEnv): string[] {
  const raw = env.AUTH_BYPASS_EMAILS?.trim();
  if (!raw) return [];

  if ((env.NODE_ENV ?? 'development') === 'production') {
    throw new Error(
      'AUTH_BYPASS_EMAILS is set while NODE_ENV=production. This variable disables ' +
        'one-time-code verification for the listed accounts and must never exist in a ' +
        'production environment. Refusing to start.',
    );
  }

  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  // One OpenAI-compatible endpoint, selected by base URL (see llm/client.ts).
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? '',
  llmModel: process.env.LLM_MODEL ?? '',
  cvEncryptionKey: process.env.CV_ENCRYPTION_KEY ?? '',
  cvStorageDir: process.env.CV_STORAGE_DIR ?? 'data/cv-storage',
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? '',
  apifyApiToken: process.env.APIFY_API_TOKEN ?? '',
  // Browser-automation submission (api/src/browser-agent) — personal-test
  // scope only, see compliance/risk-acceptance-log.md 2026-09-10 entry.
  // Separate key from cvEncryptionKey: a leaked session-state key exposes
  // a live authenticated JobsDB HK/104.com.tw session, not just documents.
  sessionStateEncryptionKey: process.env.SESSION_STATE_ENCRYPTION_KEY ?? '',
  sessionStateStorageDir: process.env.SESSION_STATE_STORAGE_DIR ?? 'data/session-state',
  browserAutomationEnabled: process.env.BROWSER_AUTOMATION_ENABLED === 'true',
  browserAutomationTestProfileId: process.env.BROWSER_AUTOMATION_TEST_PROFILE_ID ?? '',
  browserAutomationHeadless: process.env.BROWSER_AUTOMATION_HEADLESS !== 'false',
  authTokenTtlDays: Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 30),
  // Non-production only, and enforced as such by loadAuthBypassEmails.
  authBypassEmails: loadAuthBypassEmails(process.env),
  apns: {
    keyId: process.env.APNS_KEY_ID ?? '',
    teamId: process.env.APNS_TEAM_ID ?? '',
    bundleId: process.env.APNS_BUNDLE_ID ?? 'com.fyndra.app',
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH ?? '',
  },
};
