import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Tier 1 tests only (Decision 22): plain Node environment, no database, no
// browser, no live providers. Tier 2 database integration tests run locally via
// a separate command once the database implementation lands.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Accepted gap: the foundation ships no feature tests yet; Tier 1 suites
    // arrive with their vertical slices. Keeps `verify` green until then.
    passWithNoTests: true,
  },
})
