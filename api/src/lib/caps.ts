import { prisma } from './prisma.js';

const TERMINAL_STATUSES = ['hired', 'rejected', 'withdrawn'] as const;

/** Applications that reached `applied` today — the FR-024 daily cap counts this transition. */
export async function submissionsToday(profileId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return prisma.application.count({
    where: {
      jobInteraction: { profileId },
      status: 'applied',
      submittedAt: { gte: startOfDay },
    },
  });
}

/** Non-terminal applications to the same employer — the FR-024 per-employer cap. */
export async function openApplicationsForEmployer(profileId: string, employer: string): Promise<number> {
  return prisma.application.count({
    where: {
      jobInteraction: { profileId, jobPosting: { employer } },
      status: { notIn: [...TERMINAL_STATUSES] },
    },
  });
}
