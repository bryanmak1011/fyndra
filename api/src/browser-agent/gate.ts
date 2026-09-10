import { config } from '../config/index.js';

// Scope enforcement for the personal-test phase lives here — a config
// check, not a schema constraint — so widening it later (or shutting it
// off entirely) is a config change, not a migration. See
// compliance/risk-acceptance-log.md's 2026-09-10 entry: this subsystem is
// accepted for exactly one profile until a deliberate decision widens it.
export function isBrowserAutomationAllowed(profileId: string): boolean {
  if (!config.browserAutomationEnabled) return false;
  if (!config.browserAutomationTestProfileId) return false;
  return profileId === config.browserAutomationTestProfileId;
}
