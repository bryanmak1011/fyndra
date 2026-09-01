try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { startWorkerLoop, enqueue } from './queue/index.js';
import { registerParseCvHandler } from './queue/parse-cv.js';
import { registerCrawlHandler } from './queue/crawl.js';
import { registerRebuildMatchHandler } from './queue/rebuild-match.js';
import { logger } from './lib/logger.js';

// Handler for submit is registered here once it lands (tasks.md T069).
registerParseCvHandler();
registerCrawlHandler();
registerRebuildMatchHandler();

// Kick off the self-rescheduling crawl loop (queue/crawl.ts) if nothing is
// already pending — avoids piling up duplicate crawl jobs on every
// worker restart during development.
const { prisma } = await import('./lib/prisma.js');
const pendingCrawl = await prisma.queueJob.findFirst({ where: { type: 'crawl', status: 'pending' } });
if (!pendingCrawl) await enqueue('crawl', {});

startWorkerLoop();
logger.info('worker_started');
