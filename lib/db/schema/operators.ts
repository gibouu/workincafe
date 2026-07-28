import { type AnyPgColumn, boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { user } from './auth.generated'

// WorkinCafe authorization (Decision 8; Step 3B "Operators"). Authorization is
// separate from authentication: an active `operators` row grants the single
// launch operator capability, enforced server-side. No role hierarchy yet.
// `user_id` uses the exact type of the generated Better Auth user id (text).
export const operators = pgTable('operators', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'restrict' }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  // Nullable for the initial bootstrap operator (no creator exists yet).
  createdByUserId: text('created_by_user_id').references((): AnyPgColumn => user.id, {
    onDelete: 'restrict',
  }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
})
