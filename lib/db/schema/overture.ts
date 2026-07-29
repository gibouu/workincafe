import { sql } from 'drizzle-orm'
import { check, doublePrecision, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

// Internal Overture matching index (Decision 9; slice 2). Staging only: rows
// here are Overture-provenance basic facts keyed by the stable GERS id, used
// for our-side name/proximity match suggestions during human-confirmed
// candidate review. This table is NOT canonical data — an Overture record alone
// never makes a venue a candidate, and nothing here auto-publishes. Rows are
// upserted by the operator-run refresh CLI (never scheduled); a generated
// geography(Point,4326) column + GiST index are added in custom migration SQL,
// mirroring `places`.
export const overturePlaces = pgTable(
  'overture_places',
  {
    gersId: text('gers_id').primaryKey(),
    name: text('name').notNull(),
    primaryCategory: text('primary_category'),
    alternateCategories: jsonb('alternate_categories').$type<string[]>().notNull().default([]),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
    address: text('address'),
    website: text('website'),
    phone: text('phone'),
    confidence: doublePrecision('confidence'),
    sourceVersion: text('source_version').notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('overture_places_latitude_range', sql`${t.latitude} BETWEEN -90 AND 90`),
    check('overture_places_longitude_range', sql`${t.longitude} BETWEEN -180 AND 180`),
    check(
      'overture_places_confidence_range',
      sql`${t.confidence} IS NULL OR (${t.confidence} BETWEEN 0 AND 1)`,
    ),
    check(
      'overture_places_alternate_categories_array',
      sql`jsonb_typeof(${t.alternateCategories}) = 'array'`,
    ),
    check(
      'overture_places_alternate_categories_bounded',
      sql`pg_column_size(${t.alternateCategories}) <= 4096`,
    ),
  ],
)
