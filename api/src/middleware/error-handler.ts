import type { ErrorRequestHandler } from 'express';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// Maps every thrown error to the { code, message } Error schema in
// contracts/openapi.yaml. Registered last, per Express convention.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ code: err.code, message: err.message });
    return;
  }
  logger.error('unhandled_error', { error: err instanceof Error ? err.stack : String(err) });
  res.status(500).json({ code: 'internal_error', message: 'Something went wrong' });
};
