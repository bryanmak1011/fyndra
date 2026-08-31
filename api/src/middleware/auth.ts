import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { hashSecret } from '../lib/crypto.js';
import { Errors } from '../lib/errors.js';

declare module 'express-serve-static-core' {
  interface Request {
    profileId?: string;
  }
}

// Bearer-token auth per contracts/openapi.yaml: every route except /auth/*
// requires it, and there is no refresh endpoint — an expired token means
// requesting a new one-time code (SDD §6.2).
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(Errors.unauthorized());
    return;
  }

  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashSecret(token) } });
  if (!record || record.expiresAt < new Date()) {
    next(Errors.unauthorized());
    return;
  }

  req.profileId = record.profileId;
  next();
}
