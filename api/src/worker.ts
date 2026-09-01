try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { startWorkerLoop } from './queue/index.js';
import { registerParseCvHandler } from './queue/parse-cv.js';
import { logger } from './lib/logger.js';

// Handlers for crawl, rebuild_match, and submit are registered here as
// each lands (tasks.md T052, T069).
registerParseCvHandler();

startWorkerLoop();
logger.info('worker_started');
