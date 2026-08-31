import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../lib/errors.js';

// ponytail: one tiny wrapper around zod instead of a schema-driven router
// framework — the contract already lives in contracts/openapi.yaml as
// documentation; this just enforces request bodies match it at runtime.
export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(400, 'invalid_request', result.error.issues.map((i) => i.message).join('; ')));
      return;
    }
    req.body = result.data;
    next();
  };
}
