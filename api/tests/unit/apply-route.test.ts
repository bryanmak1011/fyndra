import { determineApplyRoute } from '../../src/sourcing/apply-route.js';

// FR-009: direct submission is only ever attempted against an ATS with a
// published form schema we can actually read. Verified live 2026-09-01
// (see apply-route.ts's header comment): only Greenhouse's application
// form fields are reachable without authenticated partner access — Lever,
// Ashby, and Workable all gate their form-schema APIs behind credentials
// this product doesn't have, so they route to handoff, not
// direct_submit_allowlisted, despite being read-side GO for sourcing.
describe('determineApplyRoute', () => {
  it.each([['https://boards.greenhouse.io/testco/jobs/123'], ['https://job-boards.greenhouse.io/testco/jobs/123']])(
    'routes a Greenhouse URL (%s) to direct_submit_allowlisted — the only ATS with a public form-schema API',
    (url) => {
      expect(determineApplyRoute(url)).toBe('direct_submit_allowlisted');
    },
  );

  it.each([
    ['https://www.yourator.co/companies/testco/jobs/1'],
    ['https://hk.jobsdb.com/job/12345'],
    ['https://some-random-careers-site.com/jobs/1'],
    ['https://boards.greenhouse.io.evil.com/testco/jobs/123'], // lookalike host, not the real one
    // Lever/Ashby/Workable: read-side sourcing works (T048), but their
    // form-schema APIs require authenticated partner access we don't
    // have, so direct submission isn't safe — these fall back to handoff.
    ['https://jobs.lever.co/testco/abc-123'],
    ['https://jobs.ashbyhq.com/testco/abc-123'],
    ['https://apply.workable.com/j/ABCDEF'],
  ])('routes a non-allowlisted URL (%s) to handoff', (url) => {
    expect(determineApplyRoute(url)).toBe('handoff');
  });

  it('routes null (no resolvable employer URL) to handoff', () => {
    expect(determineApplyRoute(null)).toBe('handoff');
  });

  it('routes a malformed URL to handoff rather than throwing', () => {
    expect(determineApplyRoute('not a url at all')).toBe('handoff');
  });
});
