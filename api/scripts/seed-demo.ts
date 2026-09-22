// Standalone dev tool — NOT part of the server/worker runtime.
//
//   npm run seed:demo -- demo@fyndra.test
//   npm run seed:demo -- demo@fyndra.test --login-code 424242
//
// `--login-code` writes a known, unexpired one-time code straight into the
// database for that account, so an automated walkthrough can sign in
// without a human reading the code out of the server log. It is a database
// fixture, not a server feature: nothing in `src/` knows this code exists,
// and `POST /auth/verify` treats it exactly like any other issued code.
//
// Fills a local database with enough real-shaped HK/TW postings to drive
// the simulator walkthrough end to end, without spending a paid Apify
// actor run on every demo. The postings below are representative of what
// `sourcing/providers/jobsdb-hk.ts` and `tw104.ts` actually return
// (bilingual titles, employer apply URLs, the same market/language enum
// values) — they are demo fixtures, not scraped data, and every row is
// tagged `sourceProvider: 'demo-seed'` so it is trivially distinguishable
// from anything a real crawl produced, and trivially deletable.
try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url));
} catch {
  // no .env file — rely on the process environment
}

import { prisma } from '../src/lib/prisma.js';
import { rebuildFeedForProfile } from '../src/matching/rank.js';
import { hashSecret } from '../src/lib/crypto.js';

const DEMO_PROVIDER = 'demo-seed';

interface SeedPosting {
  externalRef: string;
  title: string;
  employer: string;
  requirementsSummary: string;
  language: 'en' | 'zh_Hant';
  market: 'HK' | 'TW';
  employerApplyUrl: string;
}

const POSTINGS: SeedPosting[] = [
  {
    externalRef: 'demo-hk-1',
    title: 'Senior Backend Engineer',
    employer: 'Octopus Cards Limited',
    requirementsSummary:
      'Design and operate payment services in TypeScript and Go. 5+ years building distributed systems, strong PostgreSQL, Kubernetes on AWS. Hong Kong based, hybrid.',
    language: 'en',
    market: 'HK',
    employerApplyUrl: 'https://careers.example-octopus.com.hk/jobs/backend-senior',
  },
  {
    externalRef: 'demo-hk-2',
    title: '後端工程師 (Backend Engineer)',
    employer: 'HKTV mall',
    requirementsSummary:
      '負責電商平台後端系統開發與維護，需熟悉 Node.js、TypeScript、PostgreSQL 及雲端架構。三年以上工作經驗，具備高流量系統經驗者優先。',
    language: 'zh_Hant',
    market: 'HK',
    employerApplyUrl: 'https://careers.example-hktv.com/apply/backend',
  },
  {
    externalRef: 'demo-hk-3',
    title: 'iOS Engineer',
    employer: 'Klook',
    requirementsSummary:
      'Swift and SwiftUI, iOS 17+, strong sense of product craft. You will own features end to end in a travel app used across Asia. 3+ years shipping to the App Store.',
    language: 'en',
    market: 'HK',
    employerApplyUrl: 'https://careers.example-klook.com/ios-engineer',
  },
  {
    externalRef: 'demo-hk-4',
    title: 'Data Engineer',
    employer: 'Cathay Pacific',
    requirementsSummary:
      'Build and operate batch and streaming pipelines. Python, SQL, Airflow, dbt, and a working knowledge of PostgreSQL and cloud warehouses. 4+ years of experience.',
    language: 'en',
    market: 'HK',
    employerApplyUrl: 'https://careers.example-cathay.com/data-engineer',
  },
  {
    externalRef: 'demo-hk-5',
    title: 'Engineering Manager, Platform',
    employer: 'WeLab Bank',
    requirementsSummary:
      'Lead a platform team of six. Hands-on background in backend engineering (TypeScript or Go), plus real experience growing engineers. Regulated-environment exposure a plus.',
    language: 'en',
    market: 'HK',
    employerApplyUrl: 'https://careers.example-welab.com/em-platform',
  },
  {
    externalRef: 'demo-tw-1',
    title: '資深後端工程師',
    employer: '玉山金控',
    requirementsSummary:
      '五年以上工作經驗，專長為後端系統開發與資料庫設計。熟悉 Node.js、TypeScript、PostgreSQL、雲端架構，需具備高流量應用程式介面建置經驗。',
    language: 'zh_Hant',
    market: 'TW',
    employerApplyUrl: 'https://careers.example-esun.com.tw/jobs/backend-senior',
  },
  {
    externalRef: 'demo-tw-2',
    title: 'Senior Software Engineer (Backend)',
    employer: 'Appier',
    requirementsSummary:
      'Go and TypeScript microservices at ad-tech scale. Kubernetes, PostgreSQL, and an appetite for performance work. English-speaking team in Taipei, 5+ years experience.',
    language: 'en',
    market: 'TW',
    employerApplyUrl: 'https://careers.example-appier.com/senior-backend',
  },
  {
    externalRef: 'demo-tw-3',
    title: '前端工程師 (React)',
    employer: 'Pinkoi',
    requirementsSummary:
      '三年以上前端開發經驗，熟悉 React、TypeScript 與現代前端工具鏈。與設計師緊密合作，負責購物體驗的介面開發。',
    language: 'zh_Hant',
    market: 'TW',
    employerApplyUrl: 'https://careers.example-pinkoi.com/frontend',
  },
  {
    externalRef: 'demo-tw-4',
    title: 'Site Reliability Engineer',
    employer: 'Gogoro',
    requirementsSummary:
      'Keep a fleet platform online. Kubernetes, Terraform, observability, and incident command. Comfortable in Go or Python. 4+ years in SRE or platform engineering.',
    language: 'en',
    market: 'TW',
    employerApplyUrl: 'https://careers.example-gogoro.com/sre',
  },
  {
    externalRef: 'demo-tw-5',
    title: '雲端架構師 (Cloud Architect)',
    employer: '台灣大哥大',
    requirementsSummary:
      '負責雲端架構設計與遷移專案，熟悉 AWS 或 GCP、Kubernetes、資料庫設計。八年以上工作經驗，需具備跨團隊溝通能力。',
    language: 'zh_Hant',
    market: 'TW',
    employerApplyUrl: 'https://careers.example-taiwanmobile.com.tw/cloud-architect',
  },
];

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('usage: npm run seed:demo -- <email>');
    process.exit(1);
  }

  // Replace rather than accumulate, so re-running is idempotent and a demo
  // never drifts into a pile of stale duplicates.
  await prisma.jobPosting.deleteMany({ where: { sourceProvider: DEMO_PROVIDER } });

  await prisma.jobPosting.createMany({
    data: POSTINGS.map((posting) => ({
      sourceProvider: DEMO_PROVIDER,
      externalRef: posting.externalRef,
      title: posting.title,
      employer: posting.employer,
      requirementsSummary: posting.requirementsSummary,
      language: posting.language,
      market: posting.market,
      employerApplyUrl: posting.employerApplyUrl,
      applyRoute: 'handoff',
    })),
  });

  const profile = await prisma.userProfile.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  // A profile with no keywords/markets scores nothing, so the feed would be
  // empty — give the demo account a plausible starting profile if the user
  // has not uploaded a CV yet, and leave a real one alone.
  if (profile.keywords.length === 0 || profile.markets.length === 0) {
    await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        keywords: profile.keywords.length > 0 ? profile.keywords : ['TypeScript', 'PostgreSQL', 'backend', 'Go'],
        markets: profile.markets.length > 0 ? profile.markets : ['HK', 'TW'],
        yoe: profile.yoe ?? 5,
      },
    });
  }

  const written = await rebuildFeedForProfile(profile.id);

  const codeFlagIndex = process.argv.indexOf('--login-code');
  if (codeFlagIndex !== -1) {
    const code = process.argv[codeFlagIndex + 1];
    if (!code || code.length !== 6) {
      console.error('--login-code needs a 6-digit code');
      process.exit(1);
    }
    await prisma.authCode.deleteMany({ where: { profileId: profile.id, consumedAt: null } });
    await prisma.authCode.create({
      data: {
        profileId: profile.id,
        codeHash: hashSecret(code),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    console.log(`login code ${code} is valid for ${email} for the next 24 hours`);
  }

  console.log(`seeded ${POSTINGS.length} demo postings; ranked ${written} feed entries for ${email}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
