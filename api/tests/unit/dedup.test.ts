import { prisma } from '../../src/lib/prisma.js';
import { ingestAll, ingestPosting } from '../../src/sourcing/ingest.js';
import type { NormalisedPosting } from '../../src/sourcing/normalise.js';

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: { startsWith: 'test-dedup-' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

const base: NormalisedPosting = {
  sourceProvider: 'test-dedup-yourator',
  externalRef: 'yr-1',
  employerApplyUrl: 'https://job-boards.greenhouse.io/testco/jobs/12345',
  title: 'Backend Engineer',
  employer: 'TestCo',
  requirementsSummary: 'Taipei',
  language: 'en',
  market: 'TW',
};

describe('FR-016b — de-duplication on employerApplyUrl', () => {
  it('the same role found via two providers collapses to one JobPosting row', async () => {
    await ingestPosting(base);
    const outcome = await ingestPosting({
      ...base,
      sourceProvider: 'test-dedup-greenhouse',
      externalRef: 'gh-1',
    });

    expect(outcome).toBe('deduped');
    const rows = await prisma.jobPosting.findMany({
      where: { employerApplyUrl: base.employerApplyUrl },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].sourceProvider).toBe('test-dedup-yourator'); // first writer stays canonical
  });

  it('two postings with different employer URLs are NOT deduped', async () => {
    await ingestPosting(base);
    const outcome = await ingestPosting({
      ...base,
      sourceProvider: 'test-dedup-greenhouse',
      externalRef: 'gh-2',
      employerApplyUrl: 'https://job-boards.greenhouse.io/testco/jobs/99999',
    });

    expect(outcome).toBe('created');
    const rows = await prisma.jobPosting.findMany({ where: { sourceProvider: { startsWith: 'test-dedup-' } } });
    expect(rows).toHaveLength(2);
  });

  it('re-ingesting the same (sourceProvider, externalRef) updates rather than duplicates', async () => {
    const first = await ingestPosting(base);
    const second = await ingestPosting({ ...base, title: 'Senior Backend Engineer' });

    expect(first).toBe('created');
    expect(second).toBe('updated');
    const rows = await prisma.jobPosting.findMany({ where: { sourceProvider: base.sourceProvider } });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Senior Backend Engineer');
  });

  it('postings with no employerApplyUrl at all are never deduped against each other', async () => {
    const noUrl: NormalisedPosting = { ...base, employerApplyUrl: null, externalRef: 'no-url-1' };
    await ingestPosting(noUrl);
    const outcome = await ingestPosting({ ...noUrl, sourceProvider: 'test-dedup-other', externalRef: 'no-url-2' });
    expect(outcome).toBe('created');
  });

  it('ingestAll summarises created/updated/deduped counts across a batch', async () => {
    const summary = await ingestAll(
      (async function* () {
        yield base;
        yield { ...base, sourceProvider: 'test-dedup-greenhouse', externalRef: 'gh-3' }; // deduped
        yield { ...base, externalRef: base.externalRef, title: 'Updated title' }; // same identity -> updated
      })(),
    );
    expect(summary).toEqual({ created: 1, updated: 1, deduped: 1 });
  });
});
