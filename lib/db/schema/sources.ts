import { sql } from 'drizzle-orm'
import { check, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { EXTERNAL_ID_MAX_LENGTH, SOURCE_KINDS } from '@/lib/domain/sources'
import { inList } from './_sql'
import { places } from './places'

// External source identities only (Step 3B source-reference amendments). No
// provider-payload/metadata JSON column exists here, so there is no storage path
// for any Google-derived content beyond the Place ID itself (GP-1 boundary):
// for source = 'google_places', external_id is the Google Place ID and nothing
// else from the Google response is stored. `curator`/`community` are provenance,
// not sources, and are intentionally absent.
export const placeSourceRefs = pgTable(
  'place_source_refs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    source: text('source', { enum: SOURCE_KINDS }).notNull(),
    externalId: text('external_id').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('place_source_refs_source_external_key').on(t.source, t.externalId),
    unique('place_source_refs_place_source_external_key').on(t.placeId, t.source, t.externalId),
    check('place_source_refs_source_valid', inList(t.source, SOURCE_KINDS)),
    // Non-empty, bounded text — not a brittle provider-specific regex.
    check(
      'place_source_refs_external_id_bounded',
      sql`length(${t.externalId}) BETWEEN 1 AND ${sql.raw(String(EXTERNAL_ID_MAX_LENGTH))}`,
    ),
  ],
)
