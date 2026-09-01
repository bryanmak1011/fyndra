import { classifyQuestion } from '../../src/apply/sensitive.js';

// Fixtures follow compliance/sensitive-questions.md point 4: at least one
// English example, one Traditional Chinese example (HK phrasing where it
// differs from TW), and one adversarial near-miss per category.

describe('Category 1 — work authorization / right to work', () => {
  it('matches English phrasing', () => {
    expect(classifyQuestion('Are you authorized to work in Hong Kong?')).toEqual({
      isSensitive: true,
      category: 'work_authorization',
    });
    expect(classifyQuestion('Do you require a work permit?').category).toBe('work_authorization');
  });

  it('matches Traditional Chinese phrasing (HK and TW)', () => {
    // This HK-specific phrase mentions both an ID card and a work permit;
    // it's sensitive either way, and the classifier's category-check order
    // (national_id checked first, since format-independent ID matches are
    // the highest-precision signal per the spec) routes it there.
    expect(classifyQuestion('有否香港身份證及有效之工作簽證')).toEqual({
      isSensitive: true,
      category: 'national_id',
    });
    expect(classifyQuestion('是否具備在台工作資格').category).toBe('work_authorization');
    expect(classifyQuestion('需要工作許可證嗎').category).toBe('work_authorization');
  });
});

describe('Category 2 — visa sponsorship', () => {
  it('matches English phrasing', () => {
    expect(classifyQuestion('Will you now or in the future require sponsorship?').category).toBe(
      'visa_sponsorship',
    );
    expect(classifyQuestion('Does this role require relocation and visa sponsorship?').category).toBe(
      'visa_sponsorship',
    );
  });

  it('does NOT flag relocation alone, without visa language', () => {
    expect(classifyQuestion('Are you willing to relocate for this role?')).toEqual({
      isSensitive: false,
      category: null,
    });
  });

  it('matches Traditional Chinese phrasing, including bare sponsorship terms (fail-closed)', () => {
    expect(classifyQuestion('是否需要僱主提供工作簽證').category).toBe('visa_sponsorship');
    expect(classifyQuestion('未來是否需要簽證贊助').category).toBe('visa_sponsorship');
    expect(classifyQuestion('需要擔保').category).toBe('visa_sponsorship'); // bare 擔保, fail-closed per spec
  });
});

describe('Category 3 — HKID / Taiwan National ID / passport', () => {
  it('matches English phrasing', () => {
    expect(classifyQuestion('HKID number').category).toBe('national_id');
    expect(classifyQuestion('Passport number').category).toBe('national_id');
    expect(classifyQuestion('Taiwan ID number').category).toBe('national_id');
  });

  it('matches Traditional Chinese phrasing (HK and TW spellings)', () => {
    expect(classifyQuestion('身分證字號').category).toBe('national_id'); // TW spelling (分)
    expect(classifyQuestion('身份證字號').category).toBe('national_id'); // TW spelling (份)
    expect(classifyQuestion('統一證號').category).toBe('national_id');
    expect(classifyQuestion('護照號碼').category).toBe('national_id');
  });

  it('flags a bare "ID No." label by format alone, independent of text (spec §3 backstop)', () => {
    const result = classifyQuestion('ID No.', { fieldFormatHint: 'A123456(7)' });
    expect(result).toEqual({ isSensitive: true, category: 'national_id' });
  });

  it('flags a Taiwan National ID format even with an unrelated label', () => {
    const result = classifyQuestion('Reference code', { fieldFormatHint: 'A123456789' });
    expect(result.category).toBe('national_id');
  });

  it('adversarial near-miss: an ordinary "employee ID" field is not auto-flagged by label alone', () => {
    // No format hint provided, and "employee ID" doesn't match any HKID/TW
    // pattern — this should NOT be swept in just for containing "ID".
    expect(classifyQuestion('Employee ID (assigned after hire)')).toEqual({
      isSensitive: false,
      category: null,
    });
  });
});

describe('Category 4 — expected/desired salary', () => {
  it('matches English phrasing', () => {
    expect(classifyQuestion('What is your expected salary?').category).toBe('salary');
    expect(classifyQuestion('Current compensation').category).toBe('salary');
  });

  it('matches Traditional Chinese phrasing (canonical 期望薪資 and variants)', () => {
    expect(classifyQuestion('期望薪資').category).toBe('salary');
    expect(classifyQuestion('希望待遇').category).toBe('salary');
    expect(classifyQuestion('目前薪資').category).toBe('salary');
  });

  it('matches a bare "薪資" label on a numeric field, per the spec\'s field-type note', () => {
    expect(classifyQuestion('薪資', { fieldTypeHint: 'numeric' }).category).toBe('salary');
  });

  it('adversarial near-miss: "expected start date" is not salary', () => {
    expect(classifyQuestion('Expected start date')).toEqual({ isSensitive: false, category: null });
  });
});

describe('Category 5 — demographics', () => {
  it('always matches gender and religion, English and Chinese', () => {
    expect(classifyQuestion('Gender').category).toBe('demographic');
    expect(classifyQuestion('性別').category).toBe('demographic');
    expect(classifyQuestion('Religion').category).toBe('demographic');
    expect(classifyQuestion('宗教信仰').category).toBe('demographic');
  });

  it('matches marital status and nationality', () => {
    expect(classifyQuestion('Marital status').category).toBe('demographic');
    expect(classifyQuestion('婚姻狀況').category).toBe('demographic');
    expect(classifyQuestion('Nationality').category).toBe('demographic');
    expect(classifyQuestion('國籍').category).toBe('demographic');
  });

  it('matches a clear date-of-birth field', () => {
    expect(classifyQuestion('Date of birth').category).toBe('demographic');
    expect(classifyQuestion('出生年月日').category).toBe('demographic');
  });

  it('adversarial near-miss: "years of experience" is not flagged as an age question', () => {
    expect(classifyQuestion('Years of experience')).toEqual({ isSensitive: false, category: null });
    expect(classifyQuestion('工作經驗')).toEqual({ isSensitive: false, category: null });
  });

  it('fails closed on a genuinely ambiguous "age" field with a DOB-shaped format hint', () => {
    const result = classifyQuestion('Age', { fieldFormatHint: '15/03/1990' });
    expect(result).toEqual({ isSensitive: true, category: 'demographic' });
  });
});

describe('Fail-closed default and scope', () => {
  it('does not flag an ordinary, unrelated question', () => {
    expect(classifyQuestion('What is your favorite programming language?')).toEqual({
      isSensitive: false,
      category: null,
    });
    expect(classifyQuestion('Why do you want to work here?')).toEqual({
      isSensitive: false,
      category: null,
    });
  });

  it('handles empty input without throwing', () => {
    expect(classifyQuestion('')).toEqual({ isSensitive: false, category: null });
    expect(classifyQuestion('   ')).toEqual({ isSensitive: false, category: null });
  });
});
