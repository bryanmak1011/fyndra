import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validateBody } from '../middleware/validate.js';

export const devicesRouter = Router();

const registerSchema = z.object({
  pushToken: z.string().min(1),
  platform: z.enum(['apns', 'fcm']),
});

// POST /devices (FR-029) — push registration for pending-question and
// needs-attention notifications; see src/notifications/ (US4).
devicesRouter.post('/', validateBody(registerSchema), async (req, res) => {
  const { pushToken, platform } = req.body as z.infer<typeof registerSchema>;
  await prisma.device.upsert({
    where: { profileId_pushToken: { profileId: req.profileId!, pushToken } },
    update: { platform },
    create: { profileId: req.profileId!, pushToken, platform },
  });
  res.status(204).end();
});
