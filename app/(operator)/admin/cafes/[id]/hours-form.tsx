'use client'

import { useActionState, useState } from 'react'
import { DAY_KEYS, type DayKey, unknownWeeklyHours, type WeeklyHoursV1 } from '@/lib/domain/hours'
import { CONFIDENCE_LEVELS } from '@/lib/domain/provenance'
import {
  type CurationFormState,
  lookupOsmHoursAction,
  type OsmLookupState,
  saveHoursAction,
} from './actions'
import { dayStateField, HOURS_MAX_INTERVALS, intervalField } from './hours-fields'

const INITIAL_SAVE: CurationFormState = {}
const INITIAL_LOOKUP: OsmLookupState = {}

type DayState = 'unknown' | 'closed' | 'open'
type OsmCandidate = NonNullable<OsmLookupState['candidates']>[number]

interface AppliedOsm {
  osmType: 'node' | 'way'
  osmId: string
  observedAt: string | null
  label: string
  schedule: WeeklyHoursV1
}

// The form renders HOURS_MAX_INTERVALS slots per day; a parse that needs more
// would silently lose intervals on save, so it stays manual-entry instead.
function fitsForm(schedule: WeeklyHoursV1): boolean {
  return DAY_KEYS.every((day) => {
    const d = schedule.days[day]
    return d.state !== 'open' || d.intervals.length <= HOURS_MAX_INTERVALS
  })
}

export function HoursForm({
  placeId,
  initial,
}: {
  placeId: string
  initial: WeeklyHoursV1 | null
}) {
  const [lookup, lookupAction, lookupPending] = useActionState(lookupOsmHoursAction, INITIAL_LOOKUP)
  const [applied, setApplied] = useState<AppliedOsm | null>(null)
  const [applyCount, setApplyCount] = useState(0)

  const apply = (c: OsmCandidate) => {
    if (!c.schedule) return
    setApplied({
      osmType: c.osmType,
      osmId: c.osmId,
      observedAt: c.lastEditedAt,
      label: `${c.name ?? '(unnamed)'}${c.lastEditedAt ? `, edited ${c.lastEditedAt.slice(0, 10)}` : ''}`,
      schedule: c.schedule,
    })
    setApplyCount((n) => n + 1)
  }

  return (
    <div>
      <form className="op-form" action={lookupAction}>
        <input type="hidden" name="placeId" value={placeId} />
        <button type="submit" disabled={lookupPending}>
          {lookupPending ? 'Looking up…' : 'Look up OSM hours (free)'}
        </button>
      </form>
      {lookup.error ? <p className="op-error">{lookup.error}</p> : null}
      {lookup.candidates ? (
        lookup.candidates.length === 0 ? (
          <p className="empty-state">No OSM cafés found within 100 m of this café.</p>
        ) : (
          <>
            <table className="op-table">
              <thead>
                <tr>
                  <th>OSM venue</th>
                  <th>Distance</th>
                  <th>opening_hours</th>
                  <th>Edited</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lookup.candidates.map((c) => (
                  <tr key={`${c.osmType}/${c.osmId}`}>
                    <td>{c.name ?? '(unnamed)'}</td>
                    <td>{c.distanceMeters} m</td>
                    <td>{c.openingHours ?? '—'}</td>
                    <td>{c.lastEditedAt ? c.lastEditedAt.slice(0, 10) : '—'}</td>
                    <td>
                      {c.openingHours === null ? (
                        <span className="empty-state">no hours</span>
                      ) : c.schedule && fitsForm(c.schedule) ? (
                        <button type="button" onClick={() => apply(c)}>
                          Apply
                        </button>
                      ) : (
                        <span className="empty-state">enter manually</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="empty-state">
              Hours data © OpenStreetMap contributors (ODbL) — prefill only; verify before saving.
            </p>
          </>
        )
      ) : null}
      {/* Keyed remount so applying a prefill re-initializes the field state
          (state-from-props does not update on prop change). */}
      <HoursFields
        key={applyCount}
        placeId={placeId}
        schedule={applied?.schedule ?? initial ?? unknownWeeklyHours()}
        osm={applied}
        onClearOsm={() => {
          setApplied(null)
          setApplyCount((n) => n + 1)
        }}
      />
    </div>
  )
}

function HoursFields({
  placeId,
  schedule,
  osm,
  onClearOsm,
}: {
  placeId: string
  schedule: WeeklyHoursV1
  osm: AppliedOsm | null
  onClearOsm: () => void
}) {
  const [state, action, pending] = useActionState(saveHoursAction, INITIAL_SAVE)
  const [dayStates, setDayStates] = useState<Record<DayKey, DayState>>(
    () =>
      Object.fromEntries(DAY_KEYS.map((d) => [d, schedule.days[d].state])) as Record<
        DayKey,
        DayState
      >,
  )

  return (
    <form className="op-form op-form-wide" action={action}>
      <input type="hidden" name="placeId" value={placeId} />
      {osm ? (
        <>
          <input type="hidden" name="osmType" value={osm.osmType} />
          <input type="hidden" name="osmId" value={osm.osmId} />
          <input type="hidden" name="osmObservedAt" value={osm.observedAt ?? ''} />
          <p className="op-baseline">
            Prefilled from OSM {osm.osmType}/{osm.osmId} ({osm.label}) — saves as an OSM-derived
            import, verified by you. You can correct any field first.{' '}
            <button type="button" onClick={onClearOsm}>
              Discard prefill
            </button>
          </p>
        </>
      ) : null}
      {DAY_KEYS.map((day) => {
        const initialDay = schedule.days[day]
        const intervals = initialDay.state === 'open' ? initialDay.intervals : []
        return (
          <fieldset className="op-hours-day" key={day}>
            <legend>{day}</legend>
            <select
              name={dayStateField(day)}
              value={dayStates[day]}
              onChange={(e) =>
                setDayStates((prev) => ({ ...prev, [day]: e.target.value as DayState }))
              }
            >
              <option value="unknown">unknown</option>
              <option value="closed">closed</option>
              <option value="open">open</option>
            </select>
            {dayStates[day] === 'open'
              ? Array.from({ length: HOURS_MAX_INTERVALS }, (_, i) => (
                  <span className="op-hours-interval" key={i}>
                    <input
                      type="time"
                      name={intervalField(day, i, 'opens')}
                      defaultValue={intervals[i]?.opens ?? ''}
                      aria-label={`${day} interval ${i + 1} opens`}
                    />
                    –
                    <input
                      type="time"
                      name={intervalField(day, i, 'closes')}
                      defaultValue={intervals[i]?.closes ?? ''}
                      aria-label={`${day} interval ${i + 1} closes`}
                    />
                    <label className="op-hours-nextday">
                      <input
                        type="checkbox"
                        name={intervalField(day, i, 'nextday')}
                        defaultChecked={intervals[i]?.closesDayOffset === 1}
                      />
                      past midnight
                    </label>
                  </span>
                ))
              : null}
          </fieldset>
        )
      })}
      <label>
        Confidence
        <select name="confidence" defaultValue="medium">
          {CONFIDENCE_LEVELS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      {state.error ? <p className="op-error">{state.error}</p> : null}
      {state.saved ? <p className="empty-state">Hours saved.</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save hours'}
      </button>
    </form>
  )
}
