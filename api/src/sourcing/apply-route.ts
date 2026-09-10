import type { ApplyRoute } from '@prisma/client';
import { isBrowserAutomationAllowed } from '../browser-agent/gate.js';

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

// Providers with a real (if still unverified — see the module comment in
// each providers/*.ts file) browser-automation driver. tw104 is
// deliberately excluded until jobsdb-hk.ts is verified end-to-end (see the
// plan's phasing) — routing an application there today would just fail
// through to needs_attention, so there's no benefit to including it early.
const BROWSER_AUTOMATED_PROVIDERS = new Set(['jobsdb-hk']);

/**
 * This is a *per-Application* decision, not baked into JobPosting.applyRoute
 * (which is set once, globally, at ingest time — before any profile is
 * involved, see sourcing/ingest.ts). Browser-automated submission is scoped
 * to one personal-test profile (see browser-agent/gate.ts,
 * compliance/risk-acceptance-log.md's 2026-09-10 entry), so it can only be
 * decided once a specific profile is swiping — i.e. here, at swipe time
 * (routes/swipes.ts), not at crawl time. Falls back to the posting's own
 * applyRoute (today always `handoff`) for every other profile.
 */
export function resolveApplyRoute(
  profileId: string,
  posting: { applyRoute: ApplyRoute; sourceProvider: string; employerApplyUrl: string | null },
): ApplyRoute {
  if (
    posting.employerApplyUrl &&
    BROWSER_AUTOMATED_PROVIDERS.has(posting.sourceProvider) &&
    isBrowserAutomationAllowed(profileId)
  ) {
    return 'browser_automated';
  }
  return posting.applyRoute;
}
