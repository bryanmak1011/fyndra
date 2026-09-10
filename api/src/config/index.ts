function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: required('DATABASE_URL'),
  llmProvider: process.env.LLM_PROVIDER ?? 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
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
  apns: {
    keyId: process.env.APNS_KEY_ID ?? '',
    teamId: process.env.APNS_TEAM_ID ?? '',
    bundleId: process.env.APNS_BUNDLE_ID ?? 'com.fyndra.app',
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH ?? '',
  },
};
