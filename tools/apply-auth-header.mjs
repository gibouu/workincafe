#!/usr/bin/env node
// Prepends the "generated — do not edit" header to the Better Auth schema file
// after `auth generate` (which overwrites the file). Run by the
// `auth:schema:generate` npm script so the header survives every regeneration.
import { readFileSync, writeFileSync } from 'node:fs'

const FILE = 'lib/db/schema/auth.generated.ts'
const MARKER = 'GENERATED — DO NOT EDIT BY HAND'
const HEADER = `/**
 * ${MARKER}.
 * Generated from lib/auth/config.ts by the Better Auth CLI.
 *   CLI: auth@1.6.25   core: better-auth@1.6.25
 *   Regenerate: npm run auth:schema:generate
 * Manual edits are prohibited unless explicitly documented and reviewed.
 * The committed SQL migrations under drizzle/ remain the database history;
 * WorkinCafe authorization (operators) lives in lib/db/schema/operators.ts.
 */
`

const body = readFileSync(FILE, 'utf8')
if (body.includes(MARKER)) {
  process.exit(0)
}
writeFileSync(FILE, HEADER + '\n' + body)
console.log(`applied generated-header to ${FILE}`)
