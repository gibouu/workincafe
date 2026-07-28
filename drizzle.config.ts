import { defineConfig } from 'drizzle-kit'

// Drizzle Kit configuration (Decisions 6, 7). `db:generate` needs no database
// URL — schema → SQL only. `db:migrate` (tools/db-migrate.mjs) requires
// DATABASE_URL_DIRECT and fails clearly without it. `drizzle-kit push` is
// prohibited in every environment and no push script exists. The generated and
// custom SQL live in one ordered chain under ./drizzle.
export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema/*.ts',
  out: './drizzle',
  strict: true,
  verbose: true,
  dbCredentials: {
    // Only used by commands that touch a database; empty is fine for `generate`.
    url: process.env.DATABASE_URL_DIRECT ?? '',
  },
})
