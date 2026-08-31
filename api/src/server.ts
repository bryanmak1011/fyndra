// Native env-file loading (Node 20.6+) — ponytail: no dotenv dependency.
// Missing .env is fine in prod, where real env vars are set externally.
try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const app = createApp();
app.listen(config.port, () => {
  logger.info('api_listening', { port: config.port });
});
