import { detectLanguage, tokenize } from '../../src/matching/segment.js';

// SDD.md R5 / plan.md constitution note: a Traditional Chinese CV or JD
// MUST yield non-empty extraction. An empty result here is the specific
// silent-degradation defect that risk records, not an acceptable pass.
const ZH_HANT_CV = `
王小明
資深後端工程師

工作經驗
五年以上軟體工程經驗，專長為後端系統開發與資料庫設計。
曾於新創公司帶領三人團隊，負責建置高流量的應用程式介面。

技能
Node.js、TypeScript、PostgreSQL、雲端架構

期望薪資：面議
`;

const ZH_HANT_JOB_DESCRIPTION = `
【徵才】資深後端工程師 - 台北市
我們正在尋找一位資深後端工程師加入團隊，負責設計與維護核心系統。
需具備五年以上相關經驗，熟悉 Node.js 與資料庫設計。
`;

const EN_CV = `
Jane Doe
Senior Backend Engineer

5+ years of experience in backend development and database design.
`;

describe('detectLanguage', () => {
  it('detects a Traditional Chinese CV as zh_Hant, not en or empty-handed', () => {
    expect(detectLanguage(ZH_HANT_CV)).toBe('zh_Hant');
  });

  it('detects an English CV as en', () => {
    expect(detectLanguage(EN_CV)).toBe('en');
  });

  it('detects a genuinely balanced bilingual document as mixed', () => {
    const balanced = 'Senior Backend Engineer 資深後端工程師 with 5 years 五年經驗';
    expect(detectLanguage(balanced)).toBe('mixed');
  });
});

describe('tokenize — the R5 non-empty-extraction guarantee', () => {
  it('produces a non-empty token set for a real zh-Hant CV', () => {
    const tokens = tokenize(ZH_HANT_CV);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('produces a non-empty token set for a real zh-Hant job description', () => {
    const tokens = tokenize(ZH_HANT_JOB_DESCRIPTION);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('captures the meaningful CJK bigrams a keyword matcher needs', () => {
    const tokens = tokenize(ZH_HANT_CV);
    // "後端工程" (backend engineering) should appear as a bigram run,
    // proving the tokenizer walks Han runs rather than only picking up
    // isolated single characters.
    expect(tokens).toContain('後端');
    expect(tokens).toContain('工程');
  });

  it('still tokenizes English terms embedded in a Chinese CV', () => {
    const tokens = tokenize(ZH_HANT_CV);
    expect(tokens).toContain('node.js');
    expect(tokens).toContain('typescript');
    expect(tokens).toContain('postgresql');
  });

  it('never silently under-extracts: token count scales with real content, not near-zero', () => {
    // The specific regression this guards against: whitespace-only
    // tokenization on CJK text, which would return ~0 tokens for prose
    // that has almost no ASCII whitespace.
    const tokens = tokenize(ZH_HANT_JOB_DESCRIPTION);
    expect(tokens.length).toBeGreaterThan(10);
  });
});
