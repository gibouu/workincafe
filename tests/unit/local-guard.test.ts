import { describe, expect, it } from 'vitest'
import { assertDisposableLocalDb } from '@/lib/db/testing/local-guard'

describe('#28 production-URL safety guard', () => {
  it('refuses when no URL is provided', () => {
    expect(() => assertDisposableLocalDb(undefined)).toThrow(/disposable local/i)
    expect(() => assertDisposableLocalDb('')).toThrow()
  })

  it('refuses a hosted/production database', () => {
    expect(() =>
      assertDisposableLocalDb('postgres://u:p@ep-cool-cell-123.us-east-1.aws.neon.tech/wic'),
    ).toThrow(/hosted|production/i)
    expect(() =>
      assertDisposableLocalDb('postgres://u:p@db.abcdefgh.supabase.co:5432/postgres'),
    ).toThrow(/hosted|production/i)
  })

  it('refuses any non-local host', () => {
    expect(() => assertDisposableLocalDb('postgres://u:p@db.internal:5432/x')).toThrow(/non-local/i)
  })

  it('accepts a disposable local database', () => {
    expect(assertDisposableLocalDb('postgres://wic:wic@127.0.0.1:5433/wic_test')).toContain(
      '127.0.0.1',
    )
    expect(assertDisposableLocalDb('postgres://wic:wic@localhost:5433/wic_test')).toContain(
      'localhost',
    )
  })
})
