import { sql } from 'drizzle-orm'
import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { ACTOR_KINDS, CURATION_EVENT_TYPES } from '@/lib/domain/curation'
import { inList } from './_sql'
import { places } from './places'
import { user } from './auth.generated'

// Append-only curation history (Step 3B "Curation events"). Enforced append-only
// by a database trigger added in custom SQL. Structured top-level fields only;
// each event type has a typed application-level details schema
// (lib/domain/curation). A size bound prevents this becoming a generic log; the
// application never writes raw provider payloads, Google content, query/review
// text, photo identifiers, error objects, secrets, or personal data here.
export const curationEvents = pgTable(
  'curation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventType: text('event_type', { enum: CURATION_EVENT_TYPES }).notNull(),
    placeId: uuid('place_id').references(() => places.id, { onDelete: 'restrict' }),
    actorKind: text('actor_kind', { enum: ACTOR_KINDS }).notNull(),
    actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'restrict' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    reason: text('reason'),
    details: jsonb('details'),
  },
  (t) => [
    index('curation_events_place_idx').on(t.placeId, t.occurredAt),
    index('curation_events_type_idx').on(t.eventType),
    check('curation_events_type_valid', inList(t.eventType, CURATION_EVENT_TYPES)),
    check('curation_events_actor_kind_valid', inList(t.actorKind, ACTOR_KINDS)),
    // Operator-authored events must identify the operator; system/script may not.
    check(
      'curation_events_operator_has_user',
      sql`NOT (${t.actorKind} = 'operator' AND ${t.actorUserId} IS NULL)`,
    ),
    check(
      'curation_events_details_bounded',
      sql`${t.details} IS NULL OR pg_column_size(${t.details}) <= 4096`,
    ),
  ],
)
