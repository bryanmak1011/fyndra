// Post-submission progression the user reports themselves (FR-011a) —
// employer responses arrive outside the app. Pre-submission states
// (queued, awaiting_review, pending_needs_answer, handed_off,
// needs_attention) are system-owned and never appear here — any of them
// as a "from" status has no entry below, so every transition from one is
// correctly rejected.
const VALID_TRANSITIONS: Record<string, string[]> = {
  applied: ['responded', 'rejected', 'withdrawn'],
  responded: ['interview', 'rejected', 'withdrawn'],
  interview: ['offer', 'rejected', 'withdrawn'],
  offer: ['hired', 'rejected', 'withdrawn'],
};

export function isValidTransition(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}
