import { isValidTransition } from '../../src/apply/status-transitions.js';

describe('isValidTransition — FR-011a post-submission progression', () => {
  it('allows the documented happy path: applied -> responded -> interview -> offer -> hired', () => {
    expect(isValidTransition('applied', 'responded')).toBe(true);
    expect(isValidTransition('responded', 'interview')).toBe(true);
    expect(isValidTransition('interview', 'offer')).toBe(true);
    expect(isValidTransition('offer', 'hired')).toBe(true);
  });

  it('allows rejection from any post-submission stage', () => {
    expect(isValidTransition('applied', 'rejected')).toBe(true);
    expect(isValidTransition('responded', 'rejected')).toBe(true);
    expect(isValidTransition('interview', 'rejected')).toBe(true);
    expect(isValidTransition('offer', 'rejected')).toBe(true);
  });

  it('allows withdrawal from any post-submission stage', () => {
    expect(isValidTransition('applied', 'withdrawn')).toBe(true);
    expect(isValidTransition('interview', 'withdrawn')).toBe(true);
  });

  it('rejects hired directly from queued (system-owned pre-submission state)', () => {
    expect(isValidTransition('queued', 'hired')).toBe(false);
  });

  it('rejects hired directly from applied, skipping the intermediate stages', () => {
    expect(isValidTransition('applied', 'hired')).toBe(false);
  });

  it('rejects skipping a stage (interview from applied)', () => {
    expect(isValidTransition('applied', 'interview')).toBe(false);
  });

  it('rejects moving backwards (applied from interview)', () => {
    expect(isValidTransition('interview', 'applied')).toBe(false);
  });

  it('rejects any transition from a terminal state', () => {
    expect(isValidTransition('hired', 'responded')).toBe(false);
    expect(isValidTransition('rejected', 'applied')).toBe(false);
    expect(isValidTransition('withdrawn', 'applied')).toBe(false);
  });

  it('rejects a transition out of every system-owned pre-submission state', () => {
    for (const preSubmission of ['queued', 'awaiting_review', 'pending_needs_answer', 'handed_off', 'needs_attention']) {
      expect(isValidTransition(preSubmission, 'responded')).toBe(false);
    }
  });

  it('rejects an unrecognised status entirely', () => {
    expect(isValidTransition('applied', 'not_a_real_status')).toBe(false);
  });
});
