import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

// Better Auth configuration for the operator surface (Decision 8): email +
// password only, public sign-up disabled, no plugins (no organizations, teams,
// passkeys, 2FA, SSO, admin). Authorization is separate — an active `operators`
// row (lib/db/schema/operators.ts) gates operator capability, enforced
// server-side.
//
// NOTE: `import 'server-only'` is intentionally NOT here — the Better Auth CLI
// cannot resolve a config that imports it, and this file is the generation
// source (`npm run auth:schema:generate`). Server-only consumption is enforced
// two ways: app code imports the auth instance from `lib/auth` (index.ts, which
// carries `server-only`), and ESLint boundaries forbid components/client
// modules from importing `@/lib/auth/*`. This module also imports `pg`, which
// cannot be bundled for the browser.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://localhost:5432/placeholder',
})

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(pool), { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
})
