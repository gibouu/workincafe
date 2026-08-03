import { z } from 'zod'
import {
  DAY_KEYS,
  type DayKey,
  type HoursInterval,
  HOURS_SCHEMA_VERSION,
  HOURS_TIME_ZONE,
  type WeeklyHoursV1,
  weeklyHoursV1Schema,
} from './hours'
import { parseOsmOpeningHours } from './osm-hours'

// Structured-data hours extraction from a venue's own website (Decision 30).
// Pure: input is the fetched HTML string; extraction reads ONLY machine-
// readable schema.org markup (JSON-LD `openingHoursSpecification` /
// `openingHours`) — never free-text scraping, never guessing. Anything outside
// the supported shapes yields null and the operator reads the site themselves.
// Same operator-reviewed prefill conventions as the OSM parser: days the
// markup never mentions become `closed` (schema.org convention: the markup
// states when the venue is open; Google's own guidance uses
// opens = closes = "00:00" for an explicit all-day closure).

const SCRIPT_PATTERN =
  /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
const MAX_NODES = 500

const DAY_NAME_TO_KEY: Record<string, DayKey> = {
  monday: 'monday',
  tuesday: 'tuesday',
  wednesday: 'wednesday',
  thursday: 'thursday',
  friday: 'friday',
  saturday: 'saturday',
  sunday: 'sunday',
}

interface HoursSpec {
  dayOfWeek?: unknown
  opens?: unknown
  closes?: unknown
  validFrom?: unknown
  validThrough?: unknown
}

interface CollectedHours {
  specs: HoursSpec[]
  openingHoursStrings: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Walk a parsed JSON-LD document collecting hours-bearing properties. */
function collect(value: unknown, acc: CollectedHours, budget: { nodes: number }): void {
  if (budget.nodes <= 0) return
  budget.nodes--
  if (Array.isArray(value)) {
    for (const item of value) collect(item, acc, budget)
    return
  }
  if (!isRecord(value)) return
  const spec = value['openingHoursSpecification']
  if (spec !== undefined) {
    for (const entry of Array.isArray(spec) ? spec : [spec]) {
      if (isRecord(entry)) acc.specs.push(entry as HoursSpec)
    }
  }
  const oh = value['openingHours']
  if (typeof oh === 'string') acc.openingHoursStrings.push(oh)
  if (Array.isArray(oh)) {
    for (const entry of oh) if (typeof entry === 'string') acc.openingHoursStrings.push(entry)
  }
  for (const key of Object.keys(value)) {
    if (key === 'openingHoursSpecification' || key === 'openingHours') continue
    collect(value[key], acc, budget)
  }
}

function normalizeDay(value: unknown): DayKey | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/^https?:\/\/schema\.org\//i, '').toLowerCase()
  return DAY_NAME_TO_KEY[name] ?? null
}

/** "8:00", "08:00", "08:00:00" → "HH:mm"; anything else null. */
function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) return null
  return `${String(hours).padStart(2, '0')}:${m[2]}`
}

function specsToSchedule(specs: HoursSpec[]): WeeklyHoursV1 | null {
  const days = Object.fromEntries(
    DAY_KEYS.map((d) => [d, { state: 'closed' as const }]),
  ) as unknown as WeeklyHoursV1['days']
  let mentioned = 0

  const intervalsByDay = new Map<DayKey, HoursInterval[]>()
  for (const spec of specs) {
    // Seasonal/holiday windows are outside the subset — never silently merged.
    if (spec.validFrom !== undefined || spec.validThrough !== undefined) return null
    const rawDays = Array.isArray(spec.dayOfWeek) ? spec.dayOfWeek : [spec.dayOfWeek]
    const dayKeys: DayKey[] = []
    for (const rawDay of rawDays) {
      const key = normalizeDay(rawDay)
      if (key === null) return null
      dayKeys.push(key)
    }
    const opens = normalizeTime(spec.opens)
    const closes = normalizeTime(spec.closes)
    if (opens === null || closes === null) return null

    // Google's documented all-day-closed convention.
    if (opens === '00:00' && closes === '00:00') {
      for (const day of dayKeys) {
        mentioned++
        intervalsByDay.delete(day)
        days[day] = { state: 'closed' }
      }
      continue
    }

    const opensMin = Number(opens.slice(0, 2)) * 60 + Number(opens.slice(3))
    const closesIs24 = closes === '24:00'
    const normalizedCloses = closesIs24 ? '00:00' : closes
    const closesMin = Number(closes.slice(0, 2)) * 60 + Number(closes.slice(3))
    const interval: HoursInterval = {
      opens,
      closes: normalizedCloses,
      closesDayOffset: closesIs24 || closesMin <= opensMin ? 1 : 0,
    }
    for (const day of dayKeys) {
      mentioned++
      const list = intervalsByDay.get(day) ?? []
      list.push(interval)
      intervalsByDay.set(day, list)
      days[day] = { state: 'open', intervals: list }
    }
  }

  if (mentioned === 0) return null
  const candidate: WeeklyHoursV1 = {
    version: HOURS_SCHEMA_VERSION,
    timeZone: HOURS_TIME_ZONE,
    days,
  }
  return weeklyHoursV1Schema.safeParse(candidate).success ? candidate : null
}

export interface WebsiteHoursExtraction {
  /** Parsed full-week schedule, or null when nothing parseable was found. */
  schedule: WeeklyHoursV1 | null
  /** Whether any structured hours markup was present at all (parseable or not). */
  foundStructuredHours: boolean
}

/** Extract schema.org opening hours from a fetched HTML document. */
export function extractWebsiteHours(html: string): WebsiteHoursExtraction {
  const acc: CollectedHours = { specs: [], openingHoursStrings: [] }
  for (const match of html.matchAll(SCRIPT_PATTERN)) {
    let parsed: unknown
    try {
      parsed = JSON.parse(match[1].trim())
    } catch {
      continue
    }
    collect(parsed, acc, { nodes: MAX_NODES })
  }

  const found = acc.specs.length > 0 || acc.openingHoursStrings.length > 0
  if (!found) return { schedule: null, foundStructuredHours: false }

  // Prefer the structured specification; fall back to `openingHours` strings,
  // which share the OSM value grammar ("Mo-Fr 08:00-17:00").
  const fromSpecs = acc.specs.length > 0 ? specsToSchedule(acc.specs) : null
  const fromStrings =
    fromSpecs === null && acc.openingHoursStrings.length > 0
      ? parseOsmOpeningHours(acc.openingHoursStrings.join('; '))
      : null

  return { schedule: fromSpecs ?? fromStrings, foundStructuredHours: true }
}

// ——— Model-assisted fallback (Decision 30 amendment 30b) ———————————————————
// When a page has no parseable structured markup, the visible page text may be
// read by the approved inexpensive model as a PREFILL the operator verifies.
// Free text is less definitive than markup, so the conventions differ on
// silence: a day the text does not mention is `unknown` (never assumed
// closed); the publication gate then surfaces the gap to the operator.

const TAG_BLOCKS = /<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi
const HTML_COMMENTS = /<!--[\s\S]*?-->/g
const BLOCK_BREAKS = /<\/(p|div|li|tr|h[1-6]|section|article|header|footer|table)>|<br\s*\/?>/gi
const ALL_TAGS = /<[^>]+>/g
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
}

export const WEBSITE_TEXT_MAX_CHARS = 15_000

/** Reduce fetched HTML to bounded visible text for model input. */
export function htmlToVisibleText(html: string, maxChars: number = WEBSITE_TEXT_MAX_CHARS): string {
  let text = html.replace(TAG_BLOCKS, ' ').replace(HTML_COMMENTS, ' ')
  text = text.replace(BLOCK_BREAKS, '\n')
  text = text.replace(ALL_TAGS, ' ')
  for (const [entity, plain] of Object.entries(ENTITIES)) text = text.replaceAll(entity, plain)
  text = text
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > maxChars ? text.slice(0, maxChars) : text
}

/** Model output contract: strict JSON, either not-found or a full days object
 * (validated by wrapping into the versioned weekly schema). */
export const websiteHoursModelOutputSchema = z.object({
  found: z.boolean(),
  days: z.unknown().optional(),
})

/** Wrap a model-emitted days object into a validated schedule, or null. */
export function scheduleFromModelDays(days: unknown): WeeklyHoursV1 | null {
  const candidate = { version: HOURS_SCHEMA_VERSION, timeZone: HOURS_TIME_ZONE, days }
  const parsed = weeklyHoursV1Schema.safeParse(candidate)
  return parsed.success ? parsed.data : null
}

export const WEBSITE_HOURS_EXTRACTION_SYSTEM_PROMPT = [
  "You extract a caf\u00e9's weekly opening hours from the visible text of its own official website.",
  'Output STRICT JSON only — no prose, no code fences. One of:',
  '{"found": true, "days": {"monday": <day>, "tuesday": <day>, "wednesday": <day>, "thursday": <day>, "friday": <day>, "saturday": <day>, "sunday": <day>}}',
  '{"found": false}',
  'where <day> is {"state":"open","intervals":[{"opens":"HH:MM","closes":"HH:MM","closesDayOffset":0|1}]} or {"state":"closed"} or {"state":"unknown"}.',
  'Rules (a human operator verifies this prefill; accuracy beats completeness):',
  '- Report ONLY hours the text explicitly states. Never infer or guess.',
  '- A day the text does not mention is {"state":"unknown"} — never assume closed.',
  '- {"state":"closed"} only when the text says that day is closed.',
  '- 24-hour times; "9pm" is "21:00". closesDayOffset is 1 only when closing falls past midnight (write 24:00 closes as "00:00" with offset 1).',
  '- If hours are ambiguous, conflicting, or only seasonal/holiday, output {"found": false}.',
].join('\n')
