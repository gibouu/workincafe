import { sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { ATTRIBUTE_KINDS } from '@/lib/domain/attributes'
import { CONFIDENCE_LEVELS, OBSERVATION_DECISIONS, PROVENANCE_KINDS } from '@/lib/domain/provenance'
import { attributeKindValueMatrix, inList } from './_sql'
import { places } from './places'
import { placeSourceRefs } from './sources'
import { user } from './auth.generated'

// Study-attribute evidence model (Step 3B ruling 2), split into three concepts:
//   attribute_observations          — immutable evidence (append-only via trigger)
//   attribute_observation_decisions — append-only review decisions
//   place_attribute_current         — the current projection (a pointer only)
// Append-only enforcement and the (deferred) cross-table current-pointer
// invariant are database triggers in custom SQL. Restrictive foreign keys ensure
// deleting a place cannot silently cascade-delete its history.
//
// Provenance identity is enforced structurally (Step 3B strict-gate amendment):
// an imported observation must carry a source reference; a curator or measurement
// observation must carry an operator identity. Provenance can never be
// structurally possible but unidentified.

export const attributeObservations = pgTable(
  'attribute_observations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: ATTRIBUTE_KINDS }).notNull(),
    value: text('value').notNull(),
    provenanceKind: text('provenance_kind', { enum: PROVENANCE_KINDS }).notNull(),
    sourceRefId: uuid('source_ref_id').references(() => placeSourceRefs.id, {
      onDelete: 'restrict',
    }),
    observedByOperatorUserId: text('observed_by_operator_user_id').references(() => user.id, {
      onDelete: 'restrict',
    }),
    confidence: text('confidence', { enum: CONFIDENCE_LEVELS }).notNull(),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    note: text('note'),
  },
  (t) => [
    index('attribute_observations_place_kind_idx').on(t.placeId, t.kind),
    check('attribute_observations_kind_value_matrix', attributeKindValueMatrix(t.kind, t.value)),
    check('attribute_observations_provenance_valid', inList(t.provenanceKind, PROVENANCE_KINDS)),
    check('attribute_observations_confidence_valid', inList(t.confidence, CONFIDENCE_LEVELS)),
    // Imported evidence must reference an external source.
    check(
      'attribute_observations_imported_requires_source',
      sql`${t.provenanceKind} <> 'imported' OR ${t.sourceRefId} IS NOT NULL`,
    ),
    // Curator/measurement evidence must identify the operator who recorded it.
    check(
      'attribute_observations_attended_requires_operator',
      sql`${t.provenanceKind} = 'imported' OR ${t.observedByOperatorUserId} IS NOT NULL`,
    ),
  ],
)

export const attributeObservationDecisions = pgTable(
  'attribute_observation_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Database-generated monotonic append order. This — not (decided_at, id) — is
    // the SOLE effective-decision order, so a later append always wins even when
    // two decisions share a timestamp (Step 3B strict-gate amendment).
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    observationId: uuid('observation_id')
      .notNull()
      .references(() => attributeObservations.id, { onDelete: 'restrict' }),
    decision: text('decision', { enum: OBSERVATION_DECISIONS }).notNull(),
    decidedByOperatorUserId: text('decided_by_operator_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
    reason: text('reason'),
  },
  (t) => [
    uniqueIndex('attribute_observation_decisions_seq_key').on(t.seq),
    index('attribute_observation_decisions_obs_idx').on(t.observationId, t.seq),
    check('attribute_observation_decisions_valid', inList(t.decision, OBSERVATION_DECISIONS)),
  ],
)

// Current projection: a pointer only. Value/provenance/confidence are read
// through the referenced observation so the snapshot cannot silently disagree
// with its history (Step 3B ruling 2).
export const placeAttributeCurrent = pgTable(
  'place_attribute_current',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: ATTRIBUTE_KINDS }).notNull(),
    currentObservationId: uuid('current_observation_id')
      .notNull()
      .references(() => attributeObservations.id, { onDelete: 'restrict' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.kind] }),
    check('place_attribute_current_kind_valid', inList(t.kind, ATTRIBUTE_KINDS)),
  ],
)
