import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tier 2 database integration tests (Decision 22). Run via `npm run db:test`
// against a DISPOSABLE local Docker PostGIS container (DATABASE_URL_TEST) — never
// a hosted database (enforced by lib/db/testing/local-guard). These are
// convention-enforced (not part of `verify`) and required before review on
// schema-changing PRs. A global setup drops the public schema and migrates from
// empty once; tests run sequentially against that single migrated database.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/global-setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
})
