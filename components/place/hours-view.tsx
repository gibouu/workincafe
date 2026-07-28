import { Fragment } from 'react'
import { DAY_KEYS, type DayKey, type DayHours, type WeeklyHoursV1 } from '@/lib/domain/hours'

const DAY_LABELS: Record<DayKey, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

function describeDay(day: DayHours): string {
  if (day.state === 'unknown') return 'Unknown'
  if (day.state === 'closed') return 'Closed'
  return day.intervals
    .map((iv) => `${iv.opens}–${iv.closes}${iv.closesDayOffset === 1 ? ' (+1)' : ''}`)
    .join(', ')
}

export function HoursView({ hours }: { hours: WeeklyHoursV1 | null }) {
  if (!hours) return <p className="empty-state">Hours not yet recorded.</p>
  return (
    <dl>
      {DAY_KEYS.map((day) => (
        <Fragment key={day}>
          <dt>{DAY_LABELS[day]}</dt>
          <dd>{describeDay(hours.days[day])}</dd>
        </Fragment>
      ))}
    </dl>
  )
}
