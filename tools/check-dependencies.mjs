#!/usr/bin/env node
// Dependency-allowlist check (Decisions 2, 24d). Verifies every dependency
// declared in package.json is present in docs/approved-dependencies.json with a
// status that permits installation. The installed set may be a subset of the
// allowlist; this check only rejects declared dependencies that are unlisted,
// deferred, or prohibited. It compares actual package names only.
//
// Run: node tools/check-dependencies.mjs   (also invoked by `npm run verify`)
import { readFileSync } from 'node:fs'

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)))
const pkg = read('../package.json')
const allow = read('../docs/approved-dependencies.json')

const INSTALLABLE = new Set(['approved', 'conditional'])

const listed = new Map()
for (const section of ['runtime', 'dev']) {
  for (const [name, meta] of Object.entries(allow[section] ?? {})) {
    listed.set(name, meta.status)
  }
}

const declared = {
  ...(pkg.dependencies ?? {}),
  ...(pkg.devDependencies ?? {}),
}

const problems = []
for (const name of Object.keys(declared)) {
  if (!listed.has(name)) {
    problems.push(`unlisted dependency: ${name} (not in docs/approved-dependencies.json)`)
  } else if (!INSTALLABLE.has(listed.get(name))) {
    problems.push(`dependency ${name} has non-installable status "${listed.get(name)}"`)
  }
}

if (problems.length) {
  console.error('dependency-check: FAILED')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(
  `dependency-check: OK (${Object.keys(declared).length} declared dependencies, all allowlisted)`,
)
