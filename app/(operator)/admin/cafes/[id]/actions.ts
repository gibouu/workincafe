'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentOperator } from '@/lib/application/operators/current-operator'
import { recordAttributeObservation } from '@/lib/application/attributes/record-attribute-observation'
import { setCafeHours } from '@/lib/application/hours/set-cafe-hours'
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
    },
    operator.userId,
  )

  if (result.status === 'invalid') return { error: result.message }
  if (result.status === 'not_found') return { error: 'Café not found or not an active record.' }

  revalidatePath(`/admin/cafes/${placeId}`)
  return { saved: true }
}
