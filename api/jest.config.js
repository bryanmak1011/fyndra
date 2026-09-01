/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.test.json' }],
  },
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    // Excluded from the coverage gate, not from testing: thin plumbing
    // (server bootstrap, route wiring) is exercised through the contract
    // tests that hit it via supertest, but line coverage on an
    // app.use(...) call isn't a meaningful signal the way it is for
    // actual business logic (constitution Principle II's real target).
    '!src/server.ts',
    '!src/worker.ts',
  ],
  coverageThreshold: {
    global: { lines: 80, statements: 80, functions: 80, branches: 70 },
  },
};
