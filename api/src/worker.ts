try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { startWorkerLoop } from './queue/index.js';
import { logger } from './lib/logger.js';

// Handlers for crawl, parse_cv, rebuild_match, and submit are registered
// here as each lands (tasks.md T034, T052, T069). None exist yet.

startWorkerLoop();
logger.info('worker_started');
