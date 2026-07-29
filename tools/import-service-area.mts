#!/usr/bin/env tsx
import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { importServiceArea } from '@/lib/ingestion/service-area'
import { openScriptDb } from './script-db'

// Operator-run service-area boundary import (Step 3B amendment D). Loads the
// authoritative launch polygon (Toronto Open Data boundary GeoJSON — see
// docs/operations/ingestion.md) into `service_areas`. Upsert by code; PostGIS
// validates the geometry before any write. Run via:
//   npm run import:service-area -- --file <boundary.geojson> --source-version <v> [--dry-run]

const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    code: { type: 'string', default: 'toronto' },
    name: { type: 'string', default: 'Toronto' },
    source: { type: 'string', default: 'toronto_open_data' },
    'source-version': { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
})

if (!values.file || !values['source-version']) {
  console.error(
    'usage: npm run import:service-area -- --file <boundary.geojson> --source-version <v> [--code toronto] [--name Toronto] [--source toronto_open_data] [--dry-run]',
  )
  process.exit(1)
}

const handle = openScriptDb('import-service-area')
try {
  let boundary: unknown
  try {
    boundary = JSON.parse(await readFile(values.file, 'utf8'))
  } catch (err) {
    console.error(
      'import-service-area: could not read/parse the boundary file —',
      err instanceof Error ? err.message : err,
    )
    process.exit(1)
  }

  const result = await importServiceArea(
    handle.db,
    boundary,
    {
      code: values.code,
      name: values.name,
      source: values.source,
      sourceVersion: values['source-version'],
    },
    { dryRun: values['dry-run'] },
  )

  if (result.status === 'invalid') {
    console.error('import-service-area: FAILED —', result.message)
    process.exitCode = 1
  } else if (result.status === 'valid') {
    console.log('import-service-area: DRY RUN — boundary is valid; nothing written.')
  } else {
    console.log(`import-service-area: OK — service area '${values.code}' ${result.action}.`)
  }
} catch (err) {
  console.error('import-service-area: FAILED —', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await handle.pool.end()
}
