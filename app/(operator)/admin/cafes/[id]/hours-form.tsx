'use client'

import { useActionState, useState } from 'react'
import { DAY_KEYS, type DayKey, unknownWeeklyHours, type WeeklyHoursV1 } from '@/lib/domain/hours'
import { CONFIDENCE_LEVELS } from '@/lib/domain/provenance'
import { type CurationFormState, saveHoursAction } from './actions'
import { dayStateField, HOURS_MAX_INTERVALS, intervalField } from './hours-fields'

const INITIAL: CurationFormState = {}

type DayState = 'unknown' | 'closed' | 'open'

export function HoursForm({
  placeId,
  initial,
}: {
  placeId: string
  initial: WeeklyHoursV1 | null
}) {
  const schedule = initial ?? unknownWeeklyHours()
  const [state, action, pending] = useActionState(saveHoursAction, INITIAL)
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
