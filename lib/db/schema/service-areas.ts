import { boolean, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'

// Service areas (Step 3B amendment D) — replaces a hard-coded singleton
// `launch_boundary`. The launch deployment holds one active Toronto area, but the
// model does not depend on a one-row convention. The `geometry(MultiPolygon,4326)`
// column and its GiST index are added in custom SQL (drizzle/0000) because they
// require PostGIS. The authoritative Toronto polygon is loaded by a reviewed
// operator/import command, not embedded in the baseline migration; Tier 2 tests
// use a small deterministic fixture polygon.
export const serviceAreas = pgTable(
  'service_areas',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    source: text('source'),
    sourceVersion: text('source_version'),
    importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
    active: boolean('active').notNull().default(true),
  },
  (t) => [unique('service_areas_code_key').on(t.code)],
)
