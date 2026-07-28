import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts?: Record<string, string>
}

describe('migration governance', () => {
  it('#29 no drizzle-kit push and no db:push script exist', () => {
    const scripts = pkg.scripts ?? {}
    expect(Object.keys(scripts)).not.toContain('db:push')
    for (const [name, cmd] of Object.entries(scripts)) {
      expect(cmd, `${name} must not invoke drizzle-kit push`).not.toMatch(/drizzle-kit\s+push/)
      expect(cmd, `${name} must not invoke a db push`).not.toMatch(/\bdb:push\b/)
    }
  })

  it('#27 db:migrate fails clearly without DATABASE_URL_DIRECT', () => {
    let status = 0
    let stderr = ''
    try {
      execFileSync('node', ['tools/db-migrate.mjs'], {
        env: { ...process.env, DATABASE_URL_DIRECT: '', DATABASE_URL: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } catch (e) {
      const err = e as { status?: number; stderr?: Buffer }
      status = err.status ?? 1
      stderr = String(err.stderr ?? '')
    }
    expect(status).toBe(1)
    expect(stderr).toMatch(/DATABASE_URL_DIRECT/)
  })
})
