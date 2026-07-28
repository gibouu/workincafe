import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { PUBLICATION_STATES, RECORD_STATES, SLUG_MAX_LENGTH } from '@/lib/domain/places'

// Canonical WorkinCafe place record (Decisions 3, 9; Step 3B amendments A–D).
// No `category`/product-type column (amendment A). Publication and record
// lifecycle are separate dimensions (amendment B). Location is lat/lng with a
// database-generated geography point + GiST index added in custom SQL
// (amendment C) — see drizzle/0000 custom section. Hours live in `place_hours`,
// not here (ruling 3).
export const places = pgTable(
  'places',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    address: text('address'),
    neighborhood: text('neighborhood'),
    website: text('website'),
    phone: text('phone'),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    publicationState: text('publication_state', { enum: PUBLICATION_STATES })
      .notNull()
      .default('draft'),
    recordState: text('record_state', { enum: RECORD_STATES }).notNull().default('active'),
    duplicateOfPlaceId: uuid('duplicate_of_place_id').references((): AnyPgColumn => places.id, {
      onDelete: 'restrict',
    }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('places_slug_key').on(t.slug),
    index('places_publication_state_idx').on(t.publicationState),
    index('places_record_state_idx').on(t.recordState),
    check('places_latitude_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('places_longitude_range', sql`${t.longitude} BETWEEN -180 AND 180`),
    // POSIX ERE (uses a capturing group; POSIX has no (?:…)). Mirrors SLUG_PATTERN.
    check(
      'places_slug_format',
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.slug}) <= ${sql.raw(String(SLUG_MAX_LENGTH))}`,
    ),
    // A published place must be active (amendment B).
    check(
      'places_published_requires_active',
      sql`NOT (${t.publicationState} = 'published' AND ${t.recordState} <> 'active')`,
    ),
    // duplicate_of_place_id present exactly when record_state = 'duplicate'.
    check(
      'places_duplicate_ref_matches_state',
      sql`(${t.recordState} = 'duplicate') = (${t.duplicateOfPlaceId} IS NOT NULL)`,
    ),
    // A place cannot duplicate itself.
    check(
      'places_no_self_duplicate',
      sql`${t.duplicateOfPlaceId} IS NULL OR ${t.duplicateOfPlaceId} <> ${t.id}`,
    ),
    // closed_at present exactly when record_state = 'closed'.
    check(
      'places_closed_at_matches_state',
      sql`(${t.recordState} = 'closed') = (${t.closedAt} IS NOT NULL)`,
    ),
  ],
)
