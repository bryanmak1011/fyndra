import { PrismaClient } from '@prisma/client';

// ponytail: one client, one file, imported everywhere. No DI container for
// a single-datasource app.
export const prisma = new PrismaClient();
