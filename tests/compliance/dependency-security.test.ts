import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Enforces the architectural mitigations that Decision 26's advisory dispositions
// depend on (docs/security/advisory-dispositions.json). If a mitigation here
// regresses, the corresponding accepted/not-reachable disposition must be
// re-reviewed.
const ROOT = process.cwd()
const FIRST_PARTY = ['app', 'components', 'lib']

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p)
  }
  return out
}

function firstPartyFiles(): string[] {
  return FIRST_PARTY.flatMap((d) => walk(join(ROOT, d)))
}

const importsPkg = (src: string, pkg: string) =>
  new RegExp(`(from\\s+['"]${pkg}['"]|require\\(\\s*['"]${pkg}['"]\\s*\\))`).test(src)

describe('Decision 26 dependency-security mitigations', () => {
  it('sharp: Next.js image optimization is disabled globally', () => {
    // Mitigates GHSA-f88m (sharp/libvips): the optimizer never processes images.
    // Read as text (next.config.mjs is untyped JS) — the config is a plain literal.
    const cfg = readFileSync(join(ROOT, 'next.config.mjs'), 'utf8')
    expect(cfg).toMatch(/images\s*:\s*\{[\s\S]*?unoptimized\s*:\s*true/)
  })

  it('sharp: no first-party code imports `sharp` (no image transformation path)', () => {
    const offenders = firstPartyFiles()
      .filter((f) => importsPkg(readFileSync(f, 'utf8'), 'sharp'))
      .map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('postcss: no first-party code processes CSS via postcss at runtime', () => {
    // Mitigates the postcss advisories: only build-time, repo-controlled CSS.
    const offenders = firstPartyFiles()
      .filter((f) => importsPkg(readFileSync(f, 'utf8'), 'postcss'))
      .map((f) => f.slice(ROOT.length + 1))
    expect(offenders).toEqual([])
  })

  it('auth CLI (lodash chain) is a dev dependency only — never shipped to production', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    expect(pkg.dependencies?.auth).toBeUndefined()
    expect(pkg.devDependencies?.auth).toBeDefined()
  })

  it('no network-exposed dev tooling scripts (esbuild serve / drizzle-kit studio)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>
    }
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      expect(cmd, `${name} must not expose a dev server`).not.toMatch(
        /drizzle-kit\s+studio|esbuild[^\n]*\bserve\b/,
      )
    }
  })

  it('the advisory register and policy check exist with no hard-blocker disposition', () => {
    // The live reconciliation (npm audit vs register) runs in `verify` via
    // tools/check-security-advisories.mjs — kept out of Tier 1 to stay offline.
    expect(existsSync(join(ROOT, 'docs/security/advisory-dispositions.json'))).toBe(true)
    expect(existsSync(join(ROOT, 'tools/check-security-advisories.mjs'))).toBe(true)
    const register = JSON.parse(
      readFileSync(join(ROOT, 'docs/security/advisory-dispositions.json'), 'utf8'),
    ) as { advisories: { disposition: string; ghsa: string; mitigation: string }[] }
    expect(register.advisories.length).toBeGreaterThan(0)
    for (const a of register.advisories) {
      expect(a.disposition).not.toBe('hard-blocker')
      expect(a.mitigation, `${a.ghsa} needs a mitigation`).toBeTruthy()
    }
  })
})
