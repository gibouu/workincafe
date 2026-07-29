#!/usr/bin/env tsx
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseArgs } from 'node:util'
import { ingestOvertureExtract } from '@/lib/ingestion/overture-index'
import { overtureSourceVersionSchema } from '@/lib/domain/overture-index'
import { openScriptDb, withJobLock } from './script-db'

// Operator-run Overture matching-index refresh (Decision 19b — ~monthly per
// runbook, never scheduled). Reads the documented external extract file
// (GeoJSONSeq: one Feature per line — see docs/operations/ingestion.md),
// validates every line, and upserts the internal matching index. Idempotent;
// dry-run parses and counts without writing. Run via:
//   npm run ingest:overture -- --file <extract.geojsonseq> --source-version <release> [--dry-run]

const INGEST_LOCK_KEY = 314159265

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    'source-version': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})

const file = values.file
const versionRaw = values['source-version']
if (!file || !versionRaw) {
  console.error(
    'usage: npm run ingest:overture -- --file <extract.geojsonseq> --source-version <overture-release> [--dry-run]',
  )
  process.exit(1)
}
const version = overtureSourceVersionSchema.safeParse(versionRaw)
if (!version.success) {
  console.error('ingest-overture: --source-version must be non-empty bounded text.')
  process.exit(1)
}

const handle = openScriptDb('ingest-overture')
try {
  const summary = await withJobLock(handle, INGEST_LOCK_KEY, 'ingest-overture', () => {
    const lines = createInterface({
      input: createReadStream(file, 'utf8'),
      crlfDelay: Infinity,
    })
    return ingestOvertureExtract(handle.db, lines, {
      sourceVersion: version.data,
      dryRun: values['dry-run'],
    })
  })
  const skipped = Object.entries(summary.skipped)
    .filter(([, n]) => n > 0)
    .map(([reason, n]) => `${reason}=${n}`)
    .join(' ')
  console.log(
    `ingest-overture: ${summary.dryRun ? 'DRY RUN — ' : ''}read ${summary.linesRead} lines, ` +
      `loaded ${summary.loaded} (${summary.inserted} inserted, ${summary.updated} updated)` +
      (skipped ? `, skipped: ${skipped}` : ''),
  )
} catch (err) {
  console.error('ingest-overture: FAILED —', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await handle.pool.end()
}
