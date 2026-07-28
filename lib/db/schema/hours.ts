import { sql } from 'drizzle-orm'
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { CONFIDENCE_LEVELS, PROVENANCE_KINDS } from '@/lib/domain/provenance'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { inList } from './_sql'
import { places } from './places'
import { placeSourceRefs } from './sources'
import { user } from './auth.generated'

// Canonical current-hours record, one per place (Step 3B ruling 3). Full
// validation of the versioned schedule is Zod's job (lib/domain/hours); the
// database enforces only stable structural checks (object, version = 1, required
// keys present, bounded size). Hours are never mandatory for publication and are
// never synthesised from absence; `unknown` is distinct from `closed`.
//
// Provenance identity is enforced structurally (Step 3B strict-gate amendment):
// imported hours must carry a source reference; human-entered or verified hours
// (curator/measurement) must carry the verifying operator identity.
export const placeHours = pgTable(
  'place_hours',
  {
    placeId: uuid('place_id')
      .primaryKey()
      .references(() => places.id, { onDelete: 'restrict' }),
    schedule: jsonb('schedule').$type<WeeklyHoursV1>().notNull(),
    provenanceKind: text('provenance_kind', { enum: PROVENANCE_KINDS }).notNull(),
    sourceRefId: uuid('source_ref_id').references(() => placeSourceRefs.id, {
      onDelete: 'restrict',
    }),
    observedAt: timestamp('observed_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedByOperatorUserId: text('verified_by_operator_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    confidence: text('confidence', { enum: CONFIDENCE_LEVELS }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check('place_hours_provenance_valid', inList(t.provenanceKind, PROVENANCE_KINDS)),
    check('place_hours_confidence_valid', inList(t.confidence, CONFIDENCE_LEVELS)),
    check('place_hours_schedule_object', sql`jsonb_typeof(${t.schedule}) = 'object'`),
    check('place_hours_schedule_version', sql`${t.schedule} ->> 'version' = '1'`),
    check(
      'place_hours_schedule_shape',
      sql`${t.schedule} -> 'days' IS NOT NULL AND ${t.schedule} ->> 'timeZone' IS NOT NULL`,
    ),
    check('place_hours_schedule_bounded', sql`pg_column_size(${t.schedule}) <= 8192`),
    check(
      'place_hours_imported_requires_source',
      sql`${t.provenanceKind} <> 'imported' OR ${t.sourceRefId} IS NOT NULL`,
    ),
    check(
      'place_hours_attended_requires_operator',
      sql`${t.provenanceKind} = 'imported' OR ${t.verifiedByOperatorUserId} IS NOT NULL`,
    ),
  ],
)
