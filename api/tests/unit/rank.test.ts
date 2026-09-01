import { computeMatchScore } from '../../src/matching/rank.js';

describe('computeMatchScore — cross-lingual matching via the bilingual taxonomy', () => {
  it('matches an English CV keyword against a zh-Hant job title (SDD §10.2)', () => {
    const score = computeMatchScore(
      ['backend', 'engineering'],
      { title: '資深後端工程師', requirementsSummary: '台北市' },
    );
    expect(score).toBeGreaterThan(0);
  });

  it('matches a zh-Hant CV keyword against an English job title', () => {
    const score = computeMatchScore(
      ['後端', '工程'],
      { title: 'Senior Backend Engineer', requirementsSummary: 'Taipei' },
    );
    expect(score).toBeGreaterThan(0);
  });

  it('scores an irrelevant posting at zero, not just "low"', () => {
    const score = computeMatchScore(
      ['backend', 'engineering', 'typescript'],
      { title: 'Sales Representative', requirementsSummary: 'Hong Kong retail store' },
    );
    expect(score).toBe(0);
  });

  it('scores a same-language exact match higher than a cross-lingual one for an otherwise identical posting', () => {
    const crossLingual = computeMatchScore(['backend'], { title: '後端工程師', requirementsSummary: '' });
    const sameLanguage = computeMatchScore(['backend', 'engineer'], {
      title: 'Backend Engineer',
      requirementsSummary: '',
    });
    expect(sameLanguage).toBeGreaterThan(crossLingual);
  });

  it('weighs a title match more than a requirements-summary-only match', () => {
    const titleMatch = computeMatchScore(['backend'], { title: 'Backend Engineer', requirementsSummary: 'Remote' });
    const summaryOnlyMatch = computeMatchScore(['backend'], {
      title: 'Software Engineer',
      requirementsSummary: 'You will work on backend systems',
    });
    expect(titleMatch).toBeGreaterThan(summaryOnlyMatch);
  });

  it('returns zero for a profile with no keywords rather than throwing', () => {
    expect(computeMatchScore([], { title: 'Backend Engineer', requirementsSummary: '' })).toBe(0);
  });
});
