import { determineApplyRoute } from '../../src/sourcing/apply-route.js';

// FR-009 / 2026-09-01 finding (BLOCKERS.md, SDD.md R13): direct
// submission is disabled for every provider right now, including
// Greenhouse — its documented submission endpoint requires a private,
// employer-issued API key we have no way to obtain. Every URL routes to
// `handoff` until Product decides how to proceed (see BLOCKERS.md).
describe('determineApplyRoute', () => {
  it.each([
    ['https://boards.greenhouse.io/testco/jobs/123'],
    ['https://job-boards.greenhouse.io/testco/jobs/123'],
    ['https://jobs.lever.co/testco/abc-123'],
    ['https://jobs.ashbyhq.com/testco/abc-123'],
    ['https://apply.workable.com/j/ABCDEF'],
    ['https://www.yourator.co/companies/testco/jobs/1'],
    ['https://hk.jobsdb.com/job/12345'],
    ['https://some-random-careers-site.com/jobs/1'],
  ])('routes every URL (%s) to handoff — direct submission is disabled pending BLOCKERS.md', (url) => {
    expect(determineApplyRoute(url)).toBe('handoff');
  });

  it('routes null (no resolvable employer URL) to handoff', () => {
    expect(determineApplyRoute(null)).toBe('handoff');
  });

  it('routes a malformed URL to handoff rather than throwing', () => {
    expect(determineApplyRoute('not a url at all')).toBe('handoff');
  });
});
