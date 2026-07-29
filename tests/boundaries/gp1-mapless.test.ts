import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Enforces Decision 13d / gap ruling G4 (obligations row "GP-1 surface mapless"):
// the GP-1 candidate-seeding surface is mapless BY CONSTRUCTION — it must never
// import map components, the Google Maps client adapter, the Maps JavaScript
// loader, or the browser Maps key. Admin's approved Google display permission
// never leaks into GP-1.

const ROOT = process.cwd()
const GP1_DIRS = ['app/(operator)/gp1', 'components/gp1']

const FORBIDDEN_IMPORT = new RegExp(
  [
    String.raw`from\s+['"]@/components/map`,
    String.raw`from\s+['"]@/lib/integrations/google/client`,
    String.raw`from\s+['"]@googlemaps/`,
    String.raw`google\.maps\.importLibrary`,
    'NEXT_PUBLIC[A-Z_]*MAPS',
  ].join('|'),
)

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mts|mjs)$/.test(name)) out.push(p)
  }
  return out
}

describe('GP-1 mapless boundary', () => {
  it('no GP-1 file references map components, the Maps client/loader, or a Maps key', () => {
    const files = GP1_DIRS.flatMap((d) => {
      const abs = join(ROOT, d)
      return existsSync(abs) ? walk(abs) : []
    })
    expect(files.length, 'the GP-1 surface should contain source files').toBeGreaterThan(0)

    const offenders = files
      .filter((f) => FORBIDDEN_IMPORT.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })
})
