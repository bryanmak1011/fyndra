import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { Prisma, QueueJobType } from '@prisma/client';

export type JobHandler = (payload: Prisma.JsonValue) => Promise<void>;

const handlers = new Map<QueueJobType, JobHandler>();

export function registerHandler(type: QueueJobType, handler: JobHandler): void {
  handlers.set(type, handler);
}

export function enqueue(type: QueueJobType, payload: Prisma.JsonValue, runAfter?: Date) {
  return prisma.queueJob.create({ data: { type, payload: payload as never, runAfter } });
}

const WORKER_ID = randomUUID();
const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 3;

// ponytail: `SELECT ... FOR UPDATE SKIP LOCKED` gives us safe multi-worker
// dequeue without a broker. See QueueJob's schema comment for the ceiling.
async function claimNextJob() {
  const [job] = await prisma.$queryRaw<{ id: string; type: QueueJobType; payload: Prisma.JsonValue }[]>`
    UPDATE "QueueJob"
    SET status = 'running', "lockedAt" = now(), "lockedBy" = ${WORKER_ID}, attempts = attempts + 1
    WHERE id = (
      SELECT id FROM "QueueJob"
      WHERE status = 'pending' AND "runAfter" <= now()
      ORDER BY "runAfter"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload
  `;
  return job ?? null;
}

async function runOnce(): Promise<void> {
  const job = await claimNextJob();
  if (!job) return;

  const handler = handlers.get(job.type);
  if (!handler) {
    logger.error('queue_no_handler', { jobId: job.id, type: job.type });
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: 'failed', lastError: `no handler registered for ${job.type}` },
    });
    return;
  }

  try {
    await handler(job.payload);
    await prisma.queueJob.update({ where: { id: job.id }, data: { status: 'succeeded' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('queue_job_failed', { jobId: job.id, type: job.type, error: message });
    const record = await prisma.queueJob.findUniqueOrThrow({ where: { id: job.id } });
    const exhausted = record.attempts >= MAX_ATTEMPTS;
    await prisma.queueJob.update({
      where: { id: job.id },
      data: { status: exhausted ? 'failed' : 'pending', lastError: message },
    });
  }
}

export function startWorkerLoop(): () => void {
  const timer = setInterval(() => {
    runOnce().catch((err) => logger.error('queue_loop_error', { error: String(err) }));
  }, POLL_INTERVAL_MS);
  return () => clearInterval(timer);
}
