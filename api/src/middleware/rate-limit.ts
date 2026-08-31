import type { NextFunction, Request, Response } from 'express';
import { Errors } from '../lib/errors.js';

// ponytail: in-memory sliding window, keyed by IP + route. Fine for a
// single-process Phase 1 deployment.
// ceiling: resets on restart and doesn't share state across instances —
// move to a Postgres- or Redis-backed limiter before running >1 replica.
const hits = new Map<string, number[]>();

export function rateLimit(windowMs: number, max: number) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${req.path}:${req.ip}`;
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      next(Errors.tooManyRequests());
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
