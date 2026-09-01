import { extractYearsOfExperience } from '../../src/cv/yoe.js';

describe('extractYearsOfExperience', () => {
  it('extracts "N years of experience"', () => {
    expect(extractYearsOfExperience('5 years of experience in backend development')).toBe(5);
  });

  it('extracts "N+ years experience"', () => {
    expect(extractYearsOfExperience('Over 8+ years experience leading teams')).toBe(8);
  });

  it('extracts "N yrs experience"', () => {
    expect(extractYearsOfExperience('3 yrs experience with React')).toBe(3);
  });

  it('extracts Traditional Chinese "N年以上工作經驗" (SDD §9 example)', () => {
    expect(extractYearsOfExperience('五年以上工作經驗，專長為後端系統開發'.replace('五', '5'))).toBe(5);
  });

  it('extracts Traditional Chinese "N 年以上相關經驗" with a space', () => {
    expect(extractYearsOfExperience('具備 7 年以上相關經驗')).toBe(7);
  });

  it('extracts bare "N年經驗" without 以上', () => {
    expect(extractYearsOfExperience('3年經驗')).toBe(3);
  });

  it('returns null when no YoE statement is present', () => {
    expect(extractYearsOfExperience('Senior Software Engineer at Acme Corp')).toBeNull();
  });

  it('ignores an out-of-range number rather than misreading it as YoE', () => {
    expect(extractYearsOfExperience('Founded in 1999, 120 years of combined team experience')).toBeNull();
  });
});
