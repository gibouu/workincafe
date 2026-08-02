import {
  DAY_KEYS,
  type DayKey,
  type HoursInterval,
  HOURS_SCHEMA_VERSION,
  HOURS_TIME_ZONE,
  type WeeklyHoursV1,
  weeklyHoursV1Schema,
} from './hours'

// Conservative subset parser for OSM `opening_hours` values (Decision 29).
// This is a prefill assist, never an authority: the operator reviews every
// parsed schedule before saving, and anything outside the subset returns null
// so the raw string is shown for manual entry instead of a wrong guess.
//
// Supported subset (covers the common Toronto café values observed 2026-08-02):
//   24/7 · `Mo-Fr 08:00-18:00; Sa,Su 09:00-17:00` · `Sa-Su off` · interval
//   lists `08:00-11:30,13:00-17:00` · midnight-crossing `11:00-02:00` ·
//   `24:00` closes · wrapping day ranges `Fr-Mo` · `PH …` rules are ignored
//   (public holidays have no representation in WeeklyHoursV1).
// Everything else — months, week selectors, sunrise/sunset, open-ended
// `08:00+`, seasonal rules — fails the whole parse.
//
// Days the value never mentions become `closed`, which is the opening_hours
// specification's own semantics (the value states when the venue is open) —
// NOT a WorkinCafe guess from absence. The operator confirms or corrects.

const DAY_TOKEN_TO_KEY: Record<string, DayKey> = {
  Mo: 'monday',
  Tu: 'tuesday',
  We: 'wednesday',
  Th: 'thursday',
  Fr: 'friday',
  Sa: 'saturday',
  Su: 'sunday',
}
const DAY_TOKENS = Object.keys(DAY_TOKEN_TO_KEY)
const DAY_ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const RULE_PATTERN = new RegExp(
  `^((?:(?:${DAY_TOKENS.join('|')}|PH)(?:-(?:${DAY_TOKENS.join('|')}))?)` +
    `(?:,(?:${DAY_TOKENS.join('|')}|PH)(?:-(?:${DAY_TOKENS.join('|')}))?)*)` +
    `\\s+(off|closed|(?:\\d{2}:\\d{2}-\\d{2}:\\d{2})(?:,\\d{2}:\\d{2}-\\d{2}:\\d{2})*)$`,
)

/** Split one `;`-separated part into rules: a `,` starts a new rule only when
 * what came before already holds a time/off spec and what follows starts with
 * a day token (`Mo-We 13:00-23:00, Th 13:00-24:00` — two rules) — otherwise it
 * separates day lists (`Sa,Su 07:00-20:00`) or intervals and stays put. */
function splitCommaRules(part: string): string[] {
  const segments = part.split(',')
  const rules: string[] = []
  let current = ''
  for (const segment of segments) {
    if (current === '') {
      current = segment
      continue
    }
    const complete = /(\d{2}:\d{2}|off|closed)\s*$/.test(current)
    const startsRule = new RegExp(`^\\s*(?:${DAY_TOKENS.join('|')}|PH)\\b`).test(segment)
    if (complete && startsRule) {
      rules.push(current)
      current = segment
    } else {
      current = `${current},${segment}`
    }
  }
  if (current !== '') rules.push(current)
  return rules
}

function expandDaySpec(spec: string): DayKey[] | null {
  const days: DayKey[] = []
  for (const piece of spec.split(',')) {
    if (piece === 'PH') continue // public holidays: no weekly representation
    const range = piece.split('-')
    if (range.length === 1) {
      const key = DAY_TOKEN_TO_KEY[piece]
      if (!key) return null
      days.push(key)
      continue
    }
    if (range.length !== 2) return null
    const from = DAY_ORDER.indexOf(range[0])
    const to = DAY_ORDER.indexOf(range[1])
    if (from === -1 || to === -1) return null
    // Wrapping ranges (`Fr-Mo`) walk past the week end.
    for (let i = from; ; i = (i + 1) % 7) {
      days.push(DAY_TOKEN_TO_KEY[DAY_ORDER[i]])
      if (i === to) break
    }
  }
  return days
}

function parseIntervals(spec: string): HoursInterval[] | null {
  const intervals: HoursInterval[] = []
  for (const piece of spec.split(',')) {
    const m = piece.match(/^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/)
    if (!m) return null
    const opensMin = Number(m[1]) * 60 + Number(m[2])
    let closesHour = Number(m[3])
    const closesMin = closesHour * 60 + Number(m[4])
    if (Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[4]) > 59) return null
    // `24:00` is a valid spec closes; hours past 24:00 are out of subset.
    if (closesHour > 24 || (closesHour === 24 && Number(m[4]) !== 0)) return null
    if (closesHour === 24) closesHour = 0
    const closes = `${String(closesHour).padStart(2, '0')}:${m[4]}`
    const opens = `${m[1]}:${m[2]}`
    // Closes at-or-before opens means the interval runs past midnight.
    const closesDayOffset: 0 | 1 = closesMin <= opensMin || Number(m[3]) === 24 ? 1 : 0
    intervals.push({ opens, closes, closesDayOffset })
  }
  return intervals
}

/** Parse an OSM `opening_hours` value into a full-week schedule, or null when
 * any part of the value falls outside the conservative subset. */
export function parseOsmOpeningHours(value: string): WeeklyHoursV1 | null {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed === '') return null

  const days = Object.fromEntries(
    DAY_KEYS.map((d) => [d, { state: 'closed' as const }]),
  ) as unknown as WeeklyHoursV1['days']

  if (trimmed !== '24/7') {
    const rules = trimmed
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p !== '')
      .flatMap((p) => splitCommaRules(p).map((r) => r.trim()))
    if (rules.length === 0) return null

    for (const rule of rules) {
      const m = rule.match(RULE_PATTERN)
      if (!m) return null
      const dayKeys = expandDaySpec(m[1])
      if (dayKeys === null) return null
      if (m[2] === 'off' || m[2] === 'closed') {
        for (const day of dayKeys) days[day] = { state: 'closed' }
        continue
      }
      const intervals = parseIntervals(m[2])
      if (intervals === null) return null
      // Later rules replace earlier ones for the days they mention.
      for (const day of dayKeys) days[day] = { state: 'open', intervals }
    }
  } else {
    for (const day of DAY_KEYS) {
      days[day] = {
        state: 'open',
        intervals: [{ opens: '00:00', closes: '00:00', closesDayOffset: 1 }],
      }
    }
  }

  const candidate: WeeklyHoursV1 = {
    version: HOURS_SCHEMA_VERSION,
    timeZone: HOURS_TIME_ZONE,
    days,
  }
  // The domain schema is the final word (ordering, non-overlap).
  return weeklyHoursV1Schema.safeParse(candidate).success ? candidate : null
}
