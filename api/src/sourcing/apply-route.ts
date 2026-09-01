import type { ApplyRoute } from '@prisma/client';

// FR-009: direct submission is only ever attempted against an ATS with a
// published form schema we can actually read.
//
// Verified 2026-09-01 (T064, before writing any form-schema reader —
// same discipline the JobsDB HK mistake taught us to apply): of the four
// ATS families, ONLY Greenhouse exposes application form fields via a
// genuinely public, unauthenticated endpoint
// (boards-api.greenhouse.io/.../jobs/{id}?questions=true — confirmed
// live against a real GitLab posting, 13 real question objects
// returned). Lever's own GitHub docs (github.com/lever/postings-api)
// state outright that its public Postings API does "not expose custom
// questions built into your job postings" — its apply endpoint also
// requires an issued API key (?key=...). Ashby's application form
// schema (`applicationFormDefinition`) is only available via
// api.ashbyhq.com/jobPosting.info, which requires basic auth + a
// `jobsRead` permission grant — confirmed by a 401 on the equivalent
// public-looking URL. Workable's form-fields endpoint pattern
// (`/jobs/{shortcode}/application_form`) 404s with no valid account —
// it's part of Workable's authenticated employer-side API, not the
// public candidate-facing widget T048 reads from.
//
// So Lever/Ashby/Workable stay `handoff` until a partner/API-key
// relationship exists for each — see specs/001-job-swipe-apply/BLOCKERS.md.
// Only Greenhouse is allowlisted for direct submission right now.
const ALLOWLISTED_ATS_HOSTS = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io']);

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
