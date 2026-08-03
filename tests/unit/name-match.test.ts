import { describe, expect, it } from 'vitest'
import { osmNamePattern, scoreNameMatch } from '@/lib/domain/name-match'

// Tier 1 coverage for hours-lookup name matching (Decision 30 ruling 4):
// labeling/ranking only — the operator confirms every application.

describe('scoreNameMatch', () => {
  it('matches across separator and case differences', () => {
    expect(scoreNameMatch('Cafe23', 'Cafe 23')).toBe('match')
    expect(scoreNameMatch('Cafe23', 'CAFE-23')).toBe('match')
    expect(scoreNameMatch('Café 23', 'Cafe 23')).toBe('match')
  })

  it('scores containment and strong token overlap as close', () => {
    expect(scoreNameMatch('Sam James Coffee Bar', 'Sam James')).toBe('close')
    expect(scoreNameMatch('Balzac’s', 'Balzac’s Coffee Roasters')).toBe('close')
  })

  it('scores unrelated venues as other', () => {
    expect(scoreNameMatch('Cafe23', 'Sud Forno')).toBe('other')
    expect(scoreNameMatch('Cafe23', 'Dlish Cupcakes')).toBe('other')
    expect(scoreNameMatch('Cafe23', null)).toBe('other')
  })

  it('never matches on empty/token-free names', () => {
    expect(scoreNameMatch('***', 'Cafe 23')).toBe('other')
    expect(scoreNameMatch('Cafe 23', '—')).toBe('other')
  })
})

describe('osmNamePattern', () => {
  it('builds a separator-tolerant pattern from letter/digit runs', () => {
    const pattern = osmNamePattern('Cafe23')
    expect(pattern).toBe('Cafe[^A-Za-z0-9]*23')
    expect(new RegExp(pattern!, 'i').test('Cafe 23')).toBe(true)
    expect(new RegExp(pattern!, 'i').test('cafe-23')).toBe(true)
    expect(new RegExp(pattern!, 'i').test('Sud Forno')).toBe(false)
  })

  it('returns null when a name has no usable tokens', () => {
    expect(osmNamePattern('***')).toBeNull()
  })
})
