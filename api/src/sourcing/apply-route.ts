import type { ApplyRoute } from '@prisma/client';

// FR-009: direct submission is only ever attempted against an ATS with a
// published form schema AND a submission channel we can actually use.
//
// **2026-09-01 finding (see BLOCKERS.md, SDD.md R13) — direct submission
// is disabled for everyone, including Greenhouse.** T064 confirmed
// Greenhouse is the only ATS with a public, unauthenticated *read* API
// for form fields. But its documented *submission* endpoint
// (`POST boards-api.greenhouse.io/v1/boards/{board}/jobs/{id}`) requires
// HTTP Basic Auth with an API key from the employer's own Greenhouse
// account — a private credential we have no way to obtain for an
// employer we have no direct relationship with. The same is true, or
// worse, for Lever/Ashby/Workable (T064's earlier finding). No current
// provider has a genuinely public, third-party-usable submission
// channel — real submission would mean automating the candidate-facing
// web form itself, which is a materially different and riskier approach
// this design has avoided since rev 1 (career-ops's own D2 precedent).
//
// This function always returns `handoff` until Product makes one of the
// three calls in BLOCKERS.md. `KNOWN_FORM_SCHEMA_HOSTS` is kept (unused
// by the return value) so the Greenhouse form-schema work already done
// (T064, prefill.ts) isn't thrown away — flip `ENABLE_DIRECT_SUBMIT` only
// once there's a real submission channel to attach it to.
const ENABLE_DIRECT_SUBMIT = false;
const KNOWN_FORM_SCHEMA_HOSTS = new Set(['boards.greenhouse.io', 'job-boards.greenhouse.io']);

export function determineApplyRoute(employerApplyUrl: string | null): ApplyRoute {
  if (!ENABLE_DIRECT_SUBMIT) return 'handoff';
  if (!employerApplyUrl) return 'handoff';
  try {
    return KNOWN_FORM_SCHEMA_HOSTS.has(new URL(employerApplyUrl).hostname)
      ? 'direct_submit_allowlisted'
      : 'handoff';
  } catch {
    return 'handoff';
  }
}
