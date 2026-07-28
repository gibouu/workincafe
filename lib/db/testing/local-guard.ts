// Production-URL safety guard (Step 3B test #28). Tier 2 integration tests are
// destructive (they DROP SCHEMA and migrate from empty), so they must only ever
// target a disposable local PostGIS container — never a hosted or production
// database. Both the Tier 2 harness and the reset routine call this before
// connecting.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', ''])
const HOSTED_MARKERS = /neon\.tech|supabase\.|amazonaws\.com|rds\.|azure\.|render\.com|\.cloud\b/i

export function assertDisposableLocalDb(connectionString: string | undefined): string {
  if (!connectionString) {
    throw new Error(
      'Tier 2 tests require DATABASE_URL_TEST to point at a disposable local PostGIS database.',
    )
  }
  let host: string
  try {
    host = new URL(connectionString).hostname
  } catch {
    throw new Error('DATABASE_URL_TEST is not a valid connection URL.')
  }
  if (HOSTED_MARKERS.test(connectionString)) {
    throw new Error(
      'Refusing to run destructive Tier 2 tests: DATABASE_URL_TEST looks like a hosted/production database.',
    )
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to run destructive Tier 2 tests against non-local host "${host}". Use a local PostGIS container.`,
    )
  }
  return connectionString
}
