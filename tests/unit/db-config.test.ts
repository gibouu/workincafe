import { describe, expect, it } from 'vitest'

// #26: migration generation must work with no database URL. drizzle-kit reads
// drizzle.config.ts for `generate`; the config must resolve when
// DATABASE_URL_DIRECT is unset. (Full proof: `db:generate` runs with the var
// unset — see the review's migrate-from-empty section.)
describe('#26 drizzle config resolves without a database URL', () => {
  it('loads and exposes generation settings with DATABASE_URL_DIRECT unset', async () => {
    delete process.env.DATABASE_URL_DIRECT
    const mod = await import('../../drizzle.config')
    const cfg = mod.default as { dialect: string; out: string; schema: string }
    expect(cfg.dialect).toBe('postgresql')
    expect(cfg.out).toBe('./drizzle')
    expect(typeof cfg.schema).toBe('string')
  })
})
