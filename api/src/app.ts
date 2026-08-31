import express from 'express';
import { authRouter } from './routes/auth.js';
import { devicesRouter } from './routes/devices.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { newCorrelationId } from './lib/logger.js';

// Exported separately from server.ts so tests (Supertest) can exercise it
// without binding a port. Route mounting mirrors contracts/openapi.yaml.
export function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.headers['x-correlation-id'] ||= newCorrelationId();
    next();
  });

  app.get('/v1/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/v1/auth', authRouter);
  app.use('/v1/devices', requireAuth, devicesRouter);

  // Feed/swipe/application/profile/cv routers are added in Phases 3-6
  // (US1-US4) — see tasks.md.

  app.use(errorHandler);
  return app;
}
