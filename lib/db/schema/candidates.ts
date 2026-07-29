import { sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  CANDIDATE_DECISIONS,
  CANDIDATE_REJECT_REASONS,
  CANDIDATE_STATUSES,
  GOOGLE_PLACE_ID_MAX_LENGTH,
} from '@/lib/domain/candidates'
import { inList } from './_sql'
import { places } from './places'
import { user } from './auth.generated'

// GP-1 candidate queue (Decision 9; slice 2 pt.2). The IDs-only persistence
// boundary is STRUCTURAL here: `gp1_candidates` has exactly one Google-derived
// column — the Place ID. No name/address/coordinate/rating/payload column
// exists, so no Google content has a storage path (mirrors place_source_refs).
//
// `candidate_decisions` is append-only evidence of human review (database
// trigger in custom migration SQL, like attribute decisions): decision +
// reason code + operator + a versioned, server-built, non-Google feature
// snapshot — the approved AI-learning-ready label capture. The candidate row's
// `status` is a projection updated in the same transaction as each appended
// decision (single write path; consistency exercised by Tier 2 tests).

export const seedingRuns = pgTable(
  'seeding_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    initiatedByOperatorUserId: text('initiated_by_operator_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    queryTemplateId: text('query_template_id').notNull(),
    status: text('status', { enum: ['running', 'completed', 'failed'] }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    resultsCount: integer('results_count'),
  },
  (t) => [check('seeding_runs_status_valid', inList(t.status, ['running', 'completed', 'failed']))],
)

// Billable-call accounting: one row per actual outbound attempt (Decision 16 —
// accounted once, never auto-retried). Operational data only; append-only via
// trigger. No Google content — status code and result count are ours.
export const seedingRunAttempts = pgTable('seeding_run_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => seedingRuns.id, { onDelete: 'restrict' }),
  sku: text('sku').notNull(),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
  httpStatus: integer('http_status'),
  resultsCount: integer('results_count'),
})

export const gp1Candidates = pgTable(
  'gp1_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    googlePlaceId: text('google_place_id').notNull(),
    seedingRunId: uuid('seeding_run_id')
      .notNull()
      .references(() => seedingRuns.id, { onDelete: 'restrict' }),
    status: text('status', { enum: CANDIDATE_STATUSES }).notNull().default('pending'),
    enteredAt: timestamp('entered_at', { withTimezone: true }).defaultNow().notNull(),
    // Set when an approval creates the draft café.
    createdPlaceId: uuid('created_place_id').references(() => places.id, {
      onDelete: 'restrict',
    }),
  },
  (t) => [
    uniqueIndex('gp1_candidates_google_place_id_key').on(t.googlePlaceId),
    index('gp1_candidates_status_entered_idx').on(t.status, t.enteredAt),
    check('gp1_candidates_status_valid', inList(t.status, CANDIDATE_STATUSES)),
    check(
      'gp1_candidates_place_id_bounded',
      sql`length(${t.googlePlaceId}) BETWEEN 1 AND ${sql.raw(String(GOOGLE_PLACE_ID_MAX_LENGTH))}`,
    ),
    // Only an approved candidate may reference a created place.
    check(
      'gp1_candidates_created_place_requires_approved',
      sql`${t.createdPlaceId} IS NULL OR ${t.status} = 'approved'`,
    ),
  ],
)

export const candidateDecisions = pgTable(
  'candidate_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Database-generated monotonic append order — the sole effective-decision
    // order, mirroring attribute_observation_decisions.
    seq: bigserial('seq', { mode: 'number' }).notNull(),
    candidateId: uuid('candidate_id')
      .notNull()
      .references(() => gp1Candidates.id, { onDelete: 'restrict' }),
    decision: text('decision', { enum: CANDIDATE_DECISIONS }).notNull(),
    reasonCode: text('reason_code', { enum: CANDIDATE_REJECT_REASONS }),
    note: text('note'),
    // Identity reference to the matched Overture record (no FK: the staging
    // index is refresh-managed; the durable link lives in place_source_refs).
    matchedGersId: text('matched_gers_id'),
    decidedByOperatorUserId: text('decided_by_operator_user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'restrict' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }).defaultNow().notNull(),
    features: jsonb('features').notNull(),
    featureSetVersion: integer('feature_set_version').notNull(),
  },
  (t) => [
    uniqueIndex('candidate_decisions_seq_key').on(t.seq),
    index('candidate_decisions_candidate_idx').on(t.candidateId, t.seq),
    check('candidate_decisions_valid', inList(t.decision, CANDIDATE_DECISIONS)),
    // Reason codes belong to rejections, and every rejection has one.
    check(
      'candidate_decisions_reason_matches_decision',
      sql`(${t.decision} = 'rejected') = (${t.reasonCode} IS NOT NULL)`,
    ),
    check(
      'candidate_decisions_reason_valid',
      sql`${t.reasonCode} IS NULL OR ${inList(t.reasonCode, CANDIDATE_REJECT_REASONS)}`,
    ),
    check('candidate_decisions_features_object', sql`jsonb_typeof(${t.features}) = 'object'`),
    check('candidate_decisions_features_bounded', sql`pg_column_size(${t.features}) <= 8192`),
  ],
)
