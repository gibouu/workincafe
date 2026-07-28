import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// #30: the test harness contacts no live service. Tier 1 (this suite, run by
// `verify`) never runs the database integration tests, and Tier 2 is guarded to
// a disposable local database before any connection. The full Tier 2 run uses
// only the local Docker PostGIS container and no network.
describe('#30 no live service is contacted by the test harness', () => {
  it('Tier 1 config excludes the database integration tests', () => {
    const tier1 = readFileSync('vitest.config.ts', 'utf8')
    expect(tier1).toMatch(/exclude:[^]*tests\/integration/)
  })

  it('the Tier 2 global setup is guarded to a disposable local database', () => {
    const setup = readFileSync('tests/integration/global-setup.ts', 'utf8')
    expect(setup).toMatch(/assertDisposableLocalDb/)
  })

  it('Tier 2 database access goes through the local guard', () => {
    const helpers = readFileSync('tests/integration/helpers.ts', 'utf8')
    expect(helpers).toMatch(/assertDisposableLocalDb/)
  })
})
