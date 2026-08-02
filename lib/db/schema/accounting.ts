import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { gp1Candidates } from './candidates'

// Per-attempt accounting for billable provider calls outside seeding runs
// (Decisions 16 and 27: every billable call accounted once per actual outbound
// attempt, success or failure, never auto-retried). Append-only via trigger in
// custom migration SQL. Operational data only — SKU, context, status code;
// never any provider content.
export const providerCallAttempts = pgTable('provider_call_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: text('sku').notNull(),
  context: text('context').notNull(),
  candidateId: uuid('candidate_id').references(() => gp1Candidates.id, {
    onDelete: 'restrict',
  }),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
  httpStatus: integer('http_status'),
})
