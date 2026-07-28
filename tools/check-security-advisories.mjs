#!/usr/bin/env node
// Decision 26 — dependency-advisory gate. Dependency-free (Node builtins only).
// Runs `npm audit --json`, reconciles every advisory against the disposition
// register (docs/security/advisory-dispositions.json), prints the raw audit
// totals verbatim, and FAILS when an advisory is new/unreviewed, its
// severity/vulnerable-range changed, it is dispositioned as a hard-blocker, or a
// compatible (non-breaking) standard fix is available for a source-advisory
// package but unapplied. It never alters or conceals npm's audit output. The gate
// passes because findings are reviewed and controlled, not because they are
// hidden. Run in `npm run verify`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REGISTER = new URL('../docs/security/advisory-dispositions.json', import.meta.url)
const VALID_DISPOSITIONS = new Set([
  'remediated',
  'not-reachable',
  'accepted-residual-risk',
  'hard-blocker',
])

function runAuditJson() {
  try {
    return execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (e) {
    // `npm audit` exits non-zero when advisories exist; the JSON is still on stdout.
    if (e && e.stdout) return e.stdout.toString()
    console.error('security-check: FAILED — could not run `npm audit --json`')
    console.error('  ' + (e && e.message ? e.message : e))
    process.exit(1)
  }
}

let audit
try {
  audit = JSON.parse(runAuditJson())
} catch {
  console.error('security-check: FAILED — `npm audit --json` did not return valid JSON')
  process.exit(1)
}

const reg = JSON.parse(readFileSync(REGISTER, 'utf8'))
const regById = new Map(reg.advisories.map((a) => [a.npmAuditId, a]))

// Collect live source advisories and which source-advisory packages offer a
// compatible (non-breaking) fix.
const live = new Map()
const compatFixable = []
for (const [pkg, v] of Object.entries(audit.vulnerabilities || {})) {
  let ownsSource = false
  for (const via of v.via) {
    if (via && typeof via === 'object' && via.source) {
      ownsSource = true
      live.set(via.source, {
        id: via.source,
        ghsa: String(via.url || '')
          .split('/')
          .pop(),
        name: via.name,
        severity: via.severity,
        range: via.range,
      })
    }
  }
  if (ownsSource) {
    const fa = v.fixAvailable
    if (fa === true || (fa && typeof fa === 'object' && fa.isSemVerMajor === false)) {
      compatFixable.push(pkg)
    }
  }
}

const problems = []
const infos = []

for (const [id, a] of live) {
  const r = regById.get(id)
  if (!r) {
    problems.push(
      `new/unreviewed advisory ${a.ghsa} (${a.name}, id ${id}) — add a Decision 26 disposition`,
    )
    continue
  }
  if (r.severity !== a.severity)
    problems.push(`${a.ghsa}: severity changed "${r.severity}" → "${a.severity}" — re-review`)
  if (r.vulnerableRange !== a.range)
    problems.push(
      `${a.ghsa}: vulnerable range changed "${r.vulnerableRange}" → "${a.range}" — re-review`,
    )
  if (!VALID_DISPOSITIONS.has(r.disposition))
    problems.push(`${a.ghsa}: invalid disposition "${r.disposition}"`)
  if (r.disposition === 'hard-blocker')
    problems.push(`${a.ghsa}: disposition is hard-blocker — Step is blocked`)
  if (!r.mitigation || !r.reachability)
    problems.push(`${a.ghsa}: register entry missing mitigation/reachability`)
}

for (const pkg of compatFixable)
  problems.push(
    `compatible standard fix available for source-advisory package "${pkg}" — review and apply (npm reports a non-breaking fix)`,
  )

for (const a of reg.advisories)
  if (!live.has(a.npmAuditId))
    infos.push(
      `register entry ${a.ghsa} (id ${a.npmAuditId}) no longer reported by npm audit — verify remediation and prune`,
    )

// Raw totals — always displayed, never concealed.
const m = (audit.metadata && audit.metadata.vulnerabilities) || {}
console.log(
  `security-check: raw npm audit → total ${m.total || 0} (critical ${m.critical || 0}, high ${m.high || 0}, moderate ${m.moderate || 0}, low ${m.low || 0})`,
)
console.log(
  `security-check: ${live.size} source advisories reconciled against ${reg.advisories.length} register entries`,
)
for (const id of [...live.keys()].sort((x, y) => x - y)) {
  const a = live.get(id)
  const r = regById.get(id)
  console.log(`  - ${a.ghsa} [${a.severity}] ${a.name} → ${r ? r.disposition : 'UNREVIEWED'}`)
}
for (const i of infos) console.log('  info: ' + i)

if (problems.length) {
  console.error('security-check: FAILED')
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(
  'security-check: OK — every advisory has a Decision 26 disposition; no reachable unmitigated high/critical; no unapplied compatible standard fix.',
)
