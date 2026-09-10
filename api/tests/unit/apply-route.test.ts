import { determineApplyRoute, resolveApplyRoute } from '../../src/sourcing/apply-route.js';
import { config } from '../../src/config/index.js';

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

// resolveApplyRoute is the per-Application (per-swipe) override on top of
// determineApplyRoute's posting-level result — it's the only place
// eligible for `browser_automated`, because that route is scoped to one
// personal-test profile (browser-agent/gate.ts) which isn't known until a
// specific profile swipes. See sourcing/apply-route.ts's module comment.
describe('resolveApplyRoute', () => {
  const original = {
    browserAutomationEnabled: config.browserAutomationEnabled,
    browserAutomationTestProfileId: config.browserAutomationTestProfileId,
  };

  afterEach(() => {
    config.browserAutomationEnabled = original.browserAutomationEnabled;
    config.browserAutomationTestProfileId = original.browserAutomationTestProfileId;
  });

  const jobsdbPosting = {
    applyRoute: 'handoff' as const,
    sourceProvider: 'jobsdb-hk',
    employerApplyUrl: 'https://hk.jobsdb.com/job/12345',
  };

  it('falls back to the posting applyRoute when browser automation is disabled', () => {
    config.browserAutomationEnabled = false;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(resolveApplyRoute('profile-1', jobsdbPosting)).toBe('handoff');
  });

  it('falls back to the posting applyRoute for a profile other than the test profile', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(resolveApplyRoute('someone-else', jobsdbPosting)).toBe('handoff');
  });

  it('falls back to the posting applyRoute for a provider without a browser-submit driver (tw104)', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(
      resolveApplyRoute('profile-1', { ...jobsdbPosting, sourceProvider: 'tw104' }),
    ).toBe('handoff');
  });

  it('falls back to the posting applyRoute when there is no employerApplyUrl', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(resolveApplyRoute('profile-1', { ...jobsdbPosting, employerApplyUrl: null })).toBe('handoff');
  });

  it('returns browser_automated for jobsdb-hk under the enabled test profile', () => {
    config.browserAutomationEnabled = true;
    config.browserAutomationTestProfileId = 'profile-1';
    expect(resolveApplyRoute('profile-1', jobsdbPosting)).toBe('browser_automated');
  });
});
