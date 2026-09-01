// Loaded via `node --import` BEFORE Jest boots. This matters: Jest's
// jest-environment-node gives each test file its own `process` object,
// which only snapshots `process.env` from the real Node process at
// environment-setup time — calling `process.loadEnvFile()` *inside* a
// test file mutates the real process, but that mutation never reaches
// the sandboxed `process.env` the test file actually reads (confirmed
// empirically: cwd was correct, no exception, DATABASE_URL still
// undefined). Loading .env here, in the true outer process, before any
// Jest sandbox exists, is what actually works.
try {
  process.loadEnvFile();
} catch {
  // no .env file — rely on the process environment (e.g. CI)
}
