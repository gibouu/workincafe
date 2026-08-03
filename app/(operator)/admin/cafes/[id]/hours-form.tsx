'use client'

import { useActionState, useState } from 'react'
import { DAY_KEYS, type DayKey, unknownWeeklyHours, type WeeklyHoursV1 } from '@/lib/domain/hours'
import { CONFIDENCE_LEVELS } from '@/lib/domain/provenance'
import {
  type CurationFormState,
  lookupOsmHoursAction,
  lookupWebsiteHoursAction,
  type OsmLookupState,
  saveHoursAction,
  type WebsiteHoursState,
} from './actions'
import { dayStateField, HOURS_MAX_INTERVALS, intervalField } from './hours-fields'

const INITIAL_SAVE: CurationFormState = {}
const INITIAL_OSM: OsmLookupState = {}
const INITIAL_WEB: WebsiteHoursState = {}

type DayState = 'unknown' | 'closed' | 'open'
type OsmCandidate = NonNullable<OsmLookupState['candidates']>[number]

// A prefill applied to the form. `osm` present → saves as an OSM-derived
// import (Decision 29); absent (venue-website prefill, Decision 30) → the
// ordinary curator save, since the operator verified from the official source.
interface Applied {
  schedule: WeeklyHoursV1
  label: string
  osm: { osmType: 'node' | 'way'; osmId: string; observedAt: string | null } | null
}

// The form renders HOURS_MAX_INTERVALS slots per day; a parse that needs more
// would silently lose intervals on save, so it stays manual-entry instead.
function fitsForm(schedule: WeeklyHoursV1): boolean {
  return DAY_KEYS.every((day) => {
    const d = schedule.days[day]
    return d.state !== 'open' || d.intervals.length <= HOURS_MAX_INTERVALS
  })
}

const MATCH_LABEL: Record<OsmCandidate['nameMatch'], string> = {
  match: 'name match',
  close: 'close name',
  other: '',
}

export function HoursForm({
  placeId,
  initial,
  websiteUrl,
}: {
  placeId: string
  initial: WeeklyHoursV1 | null
  websiteUrl: string | null
}) {
  const [osm, osmAction, osmPending] = useActionState(lookupOsmHoursAction, INITIAL_OSM)
  const [web, webAction, webPending] = useActionState(lookupWebsiteHoursAction, INITIAL_WEB)
  const [applied, setApplied] = useState<Applied | null>(null)
  const [applyCount, setApplyCount] = useState(0)

  const applyOsm = (c: OsmCandidate) => {
    if (!c.schedule) return
    setApplied({
      schedule: c.schedule,
      label: `OSM ${c.osmType}/${c.osmId} (${c.name ?? '(unnamed)'}${c.lastEditedAt ? `, edited ${c.lastEditedAt.slice(0, 10)}` : ''})`,
      osm: { osmType: c.osmType, osmId: c.osmId, observedAt: c.lastEditedAt },
    })
    setApplyCount((n) => n + 1)
  }

  const applyWebsite = () => {
    const result = web.result
    if (!result?.schedule) return
    setApplied({
      schedule: result.schedule,
      label: `the venue website (${result.finalUrl}${result.source === 'ai' ? ', AI-read' : ''})`,
      osm: null,
    })
    setApplyCount((n) => n + 1)
  }

  const likely = osm.candidates?.filter((c) => c.nameMatch !== 'other') ?? []
  const nearbyOnly = osm.candidates?.filter((c) => c.nameMatch === 'other') ?? []

  const candidateRow = (c: OsmCandidate) => (
    <tr key={`${c.osmType}/${c.osmId}`}>
      <td>
        {c.name ?? '(unnamed)'}
        {MATCH_LABEL[c.nameMatch] ? (
          <em className="empty-state"> · {MATCH_LABEL[c.nameMatch]}</em>
        ) : null}
      </td>
      <td>{c.distanceMeters} m</td>
      <td>{c.openingHours ?? '—'}</td>
      <td>{c.lastEditedAt ? c.lastEditedAt.slice(0, 10) : '—'}</td>
      <td>
        {c.openingHours === null ? (
          <span className="empty-state">no hours</span>
        ) : c.schedule && fitsForm(c.schedule) ? (
          <button type="button" onClick={() => applyOsm(c)}>
            Apply
          </button>
        ) : (
          <span className="empty-state">enter manually</span>
        )}
      </td>
    </tr>
  )

  return (
    <div>
      <h3>Venue website</h3>
      {websiteUrl ? (
        <>
          <form className="op-form" action={webAction}>
            <input type="hidden" name="placeId" value={placeId} />
            <button type="submit" disabled={webPending}>
              {webPending ? 'Checking…' : 'Check website for hours (free)'}
            </button>
          </form>
          <p className="empty-state">
            <a href={websiteUrl} target="_blank" rel="noreferrer">
              Open website ↗
            </a>{' '}
            — reads the site&apos;s structured hours markup first; when there is none, one
            inexpensive AI pass reads the visible page text (source/17 amendment 30b). Always verify
            before saving.
          </p>
          {web.error ? <p className="op-error">{web.error}</p> : null}
          {web.result ? (
            web.result.schedule ? (
              <p>
                {web.result.source === 'ai'
                  ? `AI read hours from the page text on ${new URL(web.result.finalUrl).hostname} — verify each day against the site.`
                  : `Structured hours found on ${new URL(web.result.finalUrl).hostname}.`}{' '}
                <button type="button" onClick={applyWebsite}>
                  Apply
                </button>
              </p>
            ) : (
              <p className="empty-state">
                Couldn&apos;t extract hours from the site automatically — open it and enter them
                manually.
              </p>
            )
          ) : null}
        </>
      ) : (
        <p className="empty-state">No website recorded for this café.</p>
      )}

      <h3>OpenStreetMap</h3>
      <form className="op-form" action={osmAction}>
        <input type="hidden" name="placeId" value={placeId} />
        <button type="submit" disabled={osmPending}>
          {osmPending ? 'Looking up…' : 'Look up OSM hours (free)'}
        </button>
      </form>
      {osm.error ? <p className="op-error">{osm.error}</p> : null}
      {osm.candidates ? (
        <>
          {likely.length === 0 ? (
            <p className="empty-state">
              This café was not found in OSM by name — only about a quarter of Toronto cafés carry
              hours there. Use the website check or manual entry.
            </p>
          ) : (
            <table className="op-table">
              <thead>
                <tr>
                  <th>Likely match</th>
                  <th>Distance</th>
                  <th>opening_hours</th>
                  <th>Edited</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>{likely.map(candidateRow)}</tbody>
            </table>
          )}
          {nearbyOnly.length > 0 ? (
            <details>
              <summary className="empty-state">
                {nearbyOnly.length} nearby OSM venue(s) — different names, shown for reference only
              </summary>
              <table className="op-table">
                <tbody>{nearbyOnly.map(candidateRow)}</tbody>
              </table>
            </details>
          ) : null}
          <p className="empty-state">
            Hours data © OpenStreetMap contributors (ODbL) — prefill only; verify before saving.
          </p>
        </>
      ) : null}

      {/* Keyed remount so applying a prefill re-initializes the field state
          (state-from-props does not update on prop change). */}
      <HoursFields
        key={applyCount}
        placeId={placeId}
        schedule={applied?.schedule ?? initial ?? unknownWeeklyHours()}
        applied={applied}
        onClear={() => {
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
  applied,
  onClear,
}: {
  placeId: string
  schedule: WeeklyHoursV1
  applied: Applied | null
  onClear: () => void
}) {
  const [state, action, pending] = useActionState(saveHoursAction, INITIAL_SAVE)
  const [dayStates, setDayStates] = useState<Record<DayKey, DayState>>(
    () =>
      Object.fromEntries(DAY_KEYS.map((d) => [d, schedule.days[d].state])) as Record<
        DayKey,
        DayState
      >,
  )
  // The second interval slot (split service hours) renders only on demand:
  // Safari displays an empty time input with a gray example time ("12:30 PM"),
  // so an always-present unused slot reads as data. Removing a split unmounts
  // its inputs, so nothing from it is submitted.
  const [splitDays, setSplitDays] = useState<Record<DayKey, boolean>>(
    () =>
      Object.fromEntries(
        DAY_KEYS.map((d) => {
          const day = schedule.days[d]
          return [d, day.state === 'open' && day.intervals.length > 1]
        }),
      ) as Record<DayKey, boolean>,
  )

  return (
    <form className="op-form op-form-wide" action={action}>
      <input type="hidden" name="placeId" value={placeId} />
      {applied ? (
        <>
          {applied.osm ? (
            <>
              <input type="hidden" name="osmType" value={applied.osm.osmType} />
              <input type="hidden" name="osmId" value={applied.osm.osmId} />
              <input type="hidden" name="osmObservedAt" value={applied.osm.observedAt ?? ''} />
            </>
          ) : null}
          <p className="op-baseline">
            Prefilled from {applied.label} —{' '}
            {applied.osm
              ? 'saves as an OSM-derived import, verified by you.'
              : 'verify against the site, then save (curator-verified).'}{' '}
            You can correct any field first.{' '}
            <button type="button" onClick={onClear}>
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
            {dayStates[day] === 'open' ? (
              <>
                {Array.from({ length: splitDays[day] ? HOURS_MAX_INTERVALS : 1 }, (_, i) => (
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
                ))}
                <button
                  type="button"
                  className="op-hours-split"
                  onClick={() => setSplitDays((prev) => ({ ...prev, [day]: !prev[day] }))}
                >
                  {splitDays[day] ? 'remove split' : '+ split hours'}
                </button>
              </>
            ) : null}
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
