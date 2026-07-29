#!/usr/bin/env node
// Creates (or promotes) a WorkinCafe operator. Public sign-up is disabled in the
// app (Decision 8), so this operator-run CLI uses a sign-up-ENABLED Better Auth
// instance to create the auth user, then inserts an active `operators` row.
// Run against the target database (local Docker for dev, or the Neon URL to
// create a production operator):
//   DATABASE_URL='<url>' npm run create-operator -- <email> <password> [name]
// (Runs node with --experimental-strip-types so the generated Better Auth
// drizzle schema — a .ts module the adapter requires — can be imported here.)
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { account, session, user, verification } from '../lib/db/schema/auth.generated.ts'

const [, , email, password, ...nameParts] = process.argv
const name = nameParts.join(' ') || 'Operator'
const url =
  process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL

if (!email || !password) {
  console.error(
    'usage: DATABASE_URL=<url> node tools/create-operator.mjs <email> <password> [name]',
  )
  process.exit(1)
}
if (!url) {
  console.error(
    'create-operator: set DATABASE_URL (or DATABASE_URL_DIRECT) to the target database.',
  )
  process.exit(1)
}

const pool = new Pool({ connectionString: url })
const db = drizzle(pool)
const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: { enabled: true, disableSignUp: false },
})

async function findUserId(byEmail) {
  const res = await pool.query('SELECT id FROM "user" WHERE email = $1 LIMIT 1', [byEmail])
  return res.rows[0]?.id ?? null
}

try {
  let userId = await findUserId(email)
  if (userId) {
    console.log('create-operator: auth user already exists for', email, '— promoting to operator')
  } else {
    const result = await auth.api.signUpEmail({ body: { email, password, name } })
    userId = result?.user?.id ?? (await findUserId(email))
    console.log('create-operator: created auth user for', email)
  }
  if (!userId) throw new Error('could not determine the user id after sign-up')

  await pool.query(
    `INSERT INTO operators (user_id, active) VALUES ($1, true)
     ON CONFLICT (user_id) DO UPDATE SET active = true, disabled_at = NULL`,
    [userId],
  )
  console.log(`create-operator: OK — active operator ${email} (user ${userId})`)
} catch (err) {
  console.error('create-operator: FAILED —', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await pool.end()
}
