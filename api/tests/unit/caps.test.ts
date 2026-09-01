import { prisma } from '../../src/lib/prisma.js';
import { submissionsToday, openApplicationsForEmployer } from '../../src/lib/caps.js';

async function seedProfile(email: string) {
  return prisma.userProfile.create({ data: { email } });
}

async function seedPostingAndApplication(opts: {
  profileId: string;
  employer: string;
  status: 'applied' | 'queued' | 'rejected' | 'hired' | 'withdrawn';
  submittedAt?: Date;
}) {
  const posting = await prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-caps-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      title: 'Test Role',
      employer: opts.employer,
      requirementsSummary: '',
      language: 'en',
      market: 'HK',
      applyRoute: 'direct_submit_allowlisted',
    },
  });
  const interaction = await prisma.jobInteraction.create({
    data: { profileId: opts.profileId, jobPostingId: posting.id, direction: 'right' },
  });
  return prisma.application.create({
    data: {
      jobInteractionId: interaction.id,
      submissionMode: 'auto_submit',
      applyRoute: 'direct_submit_allowlisted',
      status: opts.status,
      submittedAt: opts.submittedAt,
    },
  });
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-caps-seed' } });
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-caps-' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('submissionsToday (FR-024 daily cap)', () => {
  it('counts only applications that reached `applied` status today', async () => {
    const profile = await seedProfile(`test-caps-daily-${Date.now()}@example.com`);
    await seedPostingAndApplication({ profileId: profile.id, employer: 'A', status: 'applied', submittedAt: new Date() });
    await seedPostingAndApplication({ profileId: profile.id, employer: 'B', status: 'queued' }); // not counted
    await seedPostingAndApplication({ profileId: profile.id, employer: 'C', status: 'rejected', submittedAt: new Date() }); // wrong status

    expect(await submissionsToday(profile.id)).toBe(1);
  });

  it('does not count an application submitted before today', async () => {
    const profile = await seedProfile(`test-caps-yesterday-${Date.now()}@example.com`);
    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await seedPostingAndApplication({ profileId: profile.id, employer: 'A', status: 'applied', submittedAt: yesterday });

    expect(await submissionsToday(profile.id)).toBe(0);
  });

  it('returns 0 for a profile with no applications', async () => {
    const profile = await seedProfile(`test-caps-none-${Date.now()}@example.com`);
    expect(await submissionsToday(profile.id)).toBe(0);
  });
});

describe('openApplicationsForEmployer (FR-024 per-employer cap)', () => {
  it('counts non-terminal applications to the same employer', async () => {
    const profile = await seedProfile(`test-caps-employer-${Date.now()}@example.com`);
    await seedPostingAndApplication({ profileId: profile.id, employer: 'SameCo', status: 'queued' });
    await seedPostingAndApplication({ profileId: profile.id, employer: 'SameCo', status: 'applied', submittedAt: new Date() });

    expect(await openApplicationsForEmployer(profile.id, 'SameCo')).toBe(2);
  });

  it('excludes terminal-status applications (hired, rejected, withdrawn)', async () => {
    const profile = await seedProfile(`test-caps-terminal-${Date.now()}@example.com`);
    await seedPostingAndApplication({ profileId: profile.id, employer: 'SameCo', status: 'rejected' });
    await seedPostingAndApplication({ profileId: profile.id, employer: 'SameCo', status: 'hired' });
    await seedPostingAndApplication({ profileId: profile.id, employer: 'SameCo', status: 'withdrawn' });

    expect(await openApplicationsForEmployer(profile.id, 'SameCo')).toBe(0);
  });

  it('does not count applications to a different employer', async () => {
    const profile = await seedProfile(`test-caps-other-${Date.now()}@example.com`);
    await seedPostingAndApplication({ profileId: profile.id, employer: 'OtherCo', status: 'queued' });

    expect(await openApplicationsForEmployer(profile.id, 'SameCo')).toBe(0);
  });
});
