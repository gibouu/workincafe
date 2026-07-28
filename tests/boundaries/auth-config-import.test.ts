import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Enforces the Step 3B auth boundary: `lib/auth/config.ts` (the CLI-readable
// config that omits `server-only`) may be imported only by `lib/auth/index.ts`
// (the server-only entry) and used by the Better Auth schema-generation path.
// All application code imports authentication through `lib/auth` (index.ts).
const ROOT = process.cwd()
const IGNORE = new Set(['node_modules', '.next', '.git', 'docs', 'drizzle', 'tests'])

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

function importsAuthConfig(file: string, src: string): boolean {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/')
  if (/from\s+['"][^'"]*lib\/auth\/config['"]/.test(src)) return true
  // A relative `./config` import counts only inside lib/auth.
  if (rel.startsWith('lib/auth/') && /from\s+['"]\.\/config['"]/.test(src)) return true
  return false
}

describe('auth config import boundary', () => {
  const files = walk(ROOT)

  it('only lib/auth/index.ts imports lib/auth/config', () => {
    const offenders = files
      .filter((f) => importsAuthConfig(f, readFileSync(f, 'utf8')))
      .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'))
      .filter((rel) => rel !== 'lib/auth/index.ts')
    expect(offenders).toEqual([])
  })

  it('lib/auth/index.ts does re-export from config (guard is meaningful)', () => {
    const src = readFileSync(join(ROOT, 'lib/auth/index.ts'), 'utf8')
    expect(src).toMatch(/from\s+['"]\.\/config['"]/)
  })
})
