import type { Db } from '@/lib/db/client'
import { upsertOvertureRecords } from '@/lib/db/queries/overture-mutations'
import type { OvertureIndexRecord } from '@/lib/domain/overture-index'
import { type ExtractSkipReason, parseExtractLine } from '@/lib/integrations/overture/extract'

// Operator-run Overture matching-index refresh (Decision 19b; slice 2). Never
// in the request path; produces staging data for human-confirmed matching,
// never candidates or published records. Consumes a line stream from the
// documented external extract file, validates every line, and upserts in
// batches. Idempotent: re-running the same extract yields updates, not
// duplicates. Dry-run parses and counts without writing.

export interface IngestSummary {
  linesRead: number
  loaded: number
  inserted: number
  updated: number
  skipped: Record<ExtractSkipReason, number>
  dryRun: boolean
}

const BATCH_SIZE = 500

export async function ingestOvertureExtract(
  db: Db,
  lines: AsyncIterable<string> | Iterable<string>,
  opts: { sourceVersion: string; dryRun?: boolean },
): Promise<IngestSummary> {
  const summary: IngestSummary = {
    linesRead: 0,
    loaded: 0,
    inserted: 0,
    updated: 0,
    skipped: {
      empty_line: 0,
      invalid_json: 0,
      not_a_point_feature: 0,
      missing_id_or_name: 0,
      invalid_record: 0,
    },
    dryRun: opts.dryRun === true,
  }

  // Dedup within a batch: the same GERS id twice in one multi-row upsert is a
  // database error ("cannot affect row a second time"); last occurrence wins.
  let batch = new Map<string, OvertureIndexRecord>()

  const flush = async () => {
    if (batch.size === 0) return
    const records = [...batch.values()]
    batch = new Map()
    summary.loaded += records.length
    if (summary.dryRun) return
    const counts = await upsertOvertureRecords(db, records, opts.sourceVersion)
    summary.inserted += counts.inserted
    summary.updated += counts.updated
  }

  for await (const line of lines) {
    summary.linesRead += 1
    const result = parseExtractLine(line)
    if (result.status === 'skipped') {
      summary.skipped[result.reason] += 1
      continue
    }
    batch.set(result.record.gersId, result.record)
    if (batch.size >= BATCH_SIZE) await flush()
  }
  await flush()

  return summary
}
