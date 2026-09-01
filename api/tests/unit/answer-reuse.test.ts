import { prisma } from '../../src/lib/prisma.js';
import { fingerprintQuestion, findReusableAnswer, recordAnswer } from '../../src/apply/answer-reuse.js';

async function seedProfileAndApplication(email: string) {
  const profile = await prisma.userProfile.create({ data: { email } });
  const posting = await prisma.jobPosting.create({
    data: {
      sourceProvider: 'test-reuse-seed',
      externalRef: `seed-${Date.now()}-${Math.random()}`,
      title: 'Test Role',
      employer: 'TestCo',
      requirementsSummary: '',
      language: 'en',
      market: 'HK',
      applyRoute: 'direct_submit_allowlisted',
    },
  });
  const interaction = await prisma.jobInteraction.create({
    data: { profileId: profile.id, jobPostingId: posting.id, direction: 'right' },
  });
  const application = await prisma.application.create({
    data: { jobInteractionId: interaction.id, submissionMode: 'auto_submit', applyRoute: 'direct_submit_allowlisted', status: 'queued' },
  });
  return { profile, application };
}

afterEach(async () => {
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: 'test-reuse-seed' } });
  await prisma.userProfile.deleteMany({ where: { email: { startsWith: 'test-reuse-' } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('fingerprintQuestion', () => {
  it('normalises case and surrounding whitespace to the same fingerprint', () => {
    expect(fingerprintQuestion('What is your favorite language?')).toBe(
      fingerprintQuestion('  WHAT IS YOUR FAVORITE LANGUAGE?  '),
    );
  });

  it('produces different fingerprints for genuinely different questions', () => {
    expect(fingerprintQuestion('Question A')).not.toBe(fingerprintQuestion('Question B'));
  });
});

describe('recordAnswer / findReusableAnswer (FR-021)', () => {
  it('returns null when nothing has been recorded yet', async () => {
    const { profile } = await seedProfileAndApplication(`test-reuse-empty-${Date.now()}@example.com`);
    expect(await findReusableAnswer(profile.id, 'Any question')).toBeNull();
  });

  it('reuses a recorded non-sensitive answer', async () => {
    const { profile, application } = await seedProfileAndApplication(`test-reuse-hit-${Date.now()}@example.com`);
    await recordAnswer({
      applicationId: application.id,
      profileId: profile.id,
      questionText: 'Favorite programming language?',
      answer: 'TypeScript',
      isSensitive: false,
    });

    expect(await findReusableAnswer(profile.id, 'Favorite programming language?')).toBe('TypeScript');
    // Case/whitespace-insensitive, per fingerprintQuestion's normalisation.
    expect(await findReusableAnswer(profile.id, '  FAVORITE PROGRAMMING LANGUAGE?  ')).toBe('TypeScript');
  });

  it('never reuses a sensitive answer (FR-022)', async () => {
    const { profile, application } = await seedProfileAndApplication(`test-reuse-sensitive-${Date.now()}@example.com`);
    await recordAnswer({
      applicationId: application.id,
      profileId: profile.id,
      questionText: 'Expected salary?',
      answer: 'HKD 50,000/month',
      isSensitive: true,
    });

    expect(await findReusableAnswer(profile.id, 'Expected salary?')).toBeNull();
  });

  it('does not reuse an answer belonging to a different profile', async () => {
    const { profile: profileA, application } = await seedProfileAndApplication(`test-reuse-a-${Date.now()}@example.com`);
    const { profile: profileB } = await seedProfileAndApplication(`test-reuse-b-${Date.now()}@example.com`);
    await recordAnswer({
      applicationId: application.id,
      profileId: profileA.id,
      questionText: 'Favorite language?',
      answer: 'Rust',
      isSensitive: false,
    });

    expect(await findReusableAnswer(profileB.id, 'Favorite language?')).toBeNull();
  });
});
