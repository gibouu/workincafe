'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { recordAttributeObservation } from '@/lib/application/attributes/record-attribute-observation'
import { setCafeHours } from '@/lib/application/hours/set-cafe-hours'
import { lookupOsmHours, type OsmHoursCandidate } from '@/lib/application/hours/lookup-osm-hours'
import {
  lookupWebsiteHours,
  type LookupWebsiteHoursResult,
} from '@/lib/application/hours/lookup-website-hours'
import { DAY_KEYS, HOURS_SCHEMA_VERSION, HOURS_TIME_ZONE } from '@/lib/domain/hours'
import { dayStateField, HOURS_MAX_INTERVALS, intervalField } from './hours-fields'

// Operator curation actions (Decision 16a — Server Actions are the mutation
// mechanism: thin, validated, authorized). Every action re-resolves the active
// operator server-side; there is no client-trusted authorization. Domain
// validation and effects live in the application use cases — these actions only
// authorize, normalize form values, and revalidate the curation page.

export interface CurationFormState {
  error?: string
  saved?: boolean
}

export async function recordObservationAction(
  _prev: CurationFormState,
  formData: FormData,
): Promise<CurationFormState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const placeId = String(formData.get('placeId') ?? '')
  const result = await recordAttributeObservation(
    {
      placeId,
      kind: formData.get('kind'),
      value: formData.get('value'),
      confidence: formData.get('confidence'),
      observedAt: formData.get('observedAt'),
      note: formData.get('note'),
    },
    operator.userId,
  )

  if (result.status === 'invalid') return { error: result.message }
  if (result.status === 'not_found') return { error: 'Café not found or not an active record.' }

  revalidatePath(`/admin/cafes/${placeId}`)
  return { saved: true }
}

// Per-form normalization (Decision 17): fold the per-day fields into a
// WeeklyHoursV1 candidate. An unused interval slot (both times blank) is
// dropped; a half-filled slot is kept so validation reports it.
function scheduleFromForm(formData: FormData): unknown {
  const days: Record<string, unknown> = {}
  for (const day of DAY_KEYS) {
    const state = String(formData.get(dayStateField(day)) ?? '')
    if (state !== 'open') {
      days[day] = { state }
      continue
    }
    const intervals: Array<{ opens: string; closes: string; closesDayOffset: 0 | 1 }> = []
    for (let i = 0; i < HOURS_MAX_INTERVALS; i++) {
      const opens = String(formData.get(intervalField(day, i, 'opens')) ?? '').trim()
      const closes = String(formData.get(intervalField(day, i, 'closes')) ?? '').trim()
      if (opens === '' && closes === '') continue
      const nextDay = formData.get(intervalField(day, i, 'nextday')) !== null
      intervals.push({ opens, closes, closesDayOffset: nextDay ? 1 : 0 })
    }
    days[day] = { state: 'open', intervals }
  }
  return { version: HOURS_SCHEMA_VERSION, timeZone: HOURS_TIME_ZONE, days }
}

// FormData.get() returns null for absent fields — only a fully-present OSM
// reference (applied via the lookup panel's hidden fields) becomes osmSource.
function osmSourceFromForm(formData: FormData): unknown {
  const osmType = formData.get('osmType')
  const osmId = formData.get('osmId')
  if (osmType == null || osmId == null) return undefined
  const observedAt = formData.get('osmObservedAt')
  return {
    osmType: String(osmType),
    osmId: String(osmId),
    observedAt: observedAt == null || String(observedAt) === '' ? null : String(observedAt),
  }
}

export async function saveHoursAction(
  _prev: CurationFormState,
  formData: FormData,
): Promise<CurationFormState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const placeId = String(formData.get('placeId') ?? '')
  const result = await setCafeHours(
    {
      placeId,
      confidence: formData.get('confidence'),
      schedule: scheduleFromForm(formData),
      osmSource: osmSourceFromForm(formData),
    },
    operator.userId,
  )

  if (result.status === 'invalid') return { error: result.message }
  if (result.status === 'not_found') return { error: 'Café not found or not an active record.' }
  if (result.status === 'osm_ref_conflict')
    return { error: 'That OSM element is already linked to another café — check for a duplicate.' }

  revalidatePath(`/admin/cafes/${placeId}`)
  return { saved: true }
}

// Decision 29: operator-triggered OSM hours lookup — session-only prefill
// candidates from Overpass around the café's canonical coordinates. Free
// service, single attempt, nothing persisted by the lookup itself.

export interface OsmLookupState {
  error?: string
  candidates?: OsmHoursCandidate[]
}

export async function lookupOsmHoursAction(
  _prev: OsmLookupState,
  formData: FormData,
): Promise<OsmLookupState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const placeId = String(formData.get('placeId') ?? '')
  const result = await lookupOsmHours(placeId)

  if (result.status === 'not_found') return { error: 'Café not found or not an active record.' }
  if (result.status === 'failed')
    return { error: 'OSM lookup failed (Overpass unavailable) — try again later.' }
  return { candidates: result.candidates }
}

// Decision 30: operator-triggered structured-data hours check against the
// café's own recorded official website. One page fetch per click; extraction
// is schema.org markup only; applying the prefill goes through the ordinary
// curator save (the operator verified from the official source).

export interface WebsiteHoursState {
  error?: string
  result?: Extract<LookupWebsiteHoursResult, { status: 'ok' }>
}

export async function lookupWebsiteHoursAction(
  _prev: WebsiteHoursState,
  formData: FormData,
): Promise<WebsiteHoursState> {
  const operator = await getCurrentOperator()
  if (!operator) redirect('/login')

  const placeId = String(formData.get('placeId') ?? '')
  const result = await lookupWebsiteHours(placeId)

  if (result.status === 'not_found') return { error: 'Café not found or not an active record.' }
  if (result.status === 'no_website') return { error: 'No website is recorded for this café.' }
  if (result.status === 'failed')
    return { error: 'Could not fetch the website — open it directly and enter hours manually.' }
  return { result }
}
