import type { DayKey } from '@/lib/domain/hours'

// Shared field-name scheme for the hours form: the client form renders these
// names and the Server Action reads them back. Plain module (no directive) so
// both sides can import it. The two-interval bound is a form capacity choice
// (covers split service hours), not a domain rule — the domain schema accepts
// any number of intervals.

export const HOURS_MAX_INTERVALS = 2

export function dayStateField(day: DayKey): string {
  return `${day}-state`
}

export function intervalField(day: DayKey, index: number, part: 'opens' | 'closes' | 'nextday') {
  return `${day}-${index}-${part}`
}
