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
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? '',
  authTokenTtlDays: Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 30),
  apns: {
    keyId: process.env.APNS_KEY_ID ?? '',
    teamId: process.env.APNS_TEAM_ID ?? '',
    bundleId: process.env.APNS_BUNDLE_ID ?? 'com.fyndra.app',
    privateKeyPath: process.env.APNS_PRIVATE_KEY_PATH ?? '',
  },
};
