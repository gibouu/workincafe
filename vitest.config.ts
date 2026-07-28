import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tier 1 tests (Decision 22): plain Node environment, no database, no browser, no
// live providers. Runs in `npm run verify`. Tier 2 database integration tests
// live under tests/integration and run via `npm run db:test` against a local
// Docker PostGIS container (see vitest.integration.config.ts).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/integration/**', 'node_modules/**'],
  },
})
