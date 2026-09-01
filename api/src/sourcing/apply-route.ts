import type { ApplyRoute } from '@prisma/client';

// FR-009: direct submission is only ever attempted against an ATS with a
// published form schema we've actually implemented (apply/schemas/, T064)
// — Greenhouse, Lever, Ashby, Workable. Everything else, including a
// posting whose *source* is one of those ATSes but whose employer apply
// URL points somewhere else entirely, falls back to handoff.
const ALLOWLISTED_ATS_HOSTS = new Set([
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'jobs.ashbyhq.com',
  'apply.workable.com',
]);

export function determineApplyRoute(employerApplyUrl: string | null): ApplyRoute {
  if (!employerApplyUrl) return 'handoff';
  try {
    return ALLOWLISTED_ATS_HOSTS.has(new URL(employerApplyUrl).hostname)
      ? 'direct_submit_allowlisted'
      : 'handoff';
  } catch {
    return 'handoff';
  }
}
