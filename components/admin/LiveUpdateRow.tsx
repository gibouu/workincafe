'use client';

import { Icon } from '@/components/icons/Icon';

export interface LiveUpdateRecord {
  id: string;
  place_id: string;
  user_id: string;
  noise_level: string | null;
  seating_availability: string | null;
  temperature: string | null;
  outlets: string | null;
  rotating_question: string | null;
  rotating_answer: string | null;
  created_at: string;
  is_demo: boolean;
  place_label: string | null;
  user_email: string | null;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.floor(hr / 24);
  return `${d} d ago`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sys-gray-6 px-2 py-0.5 text-[11px] font-medium text-(--text-secondary)">
      <span className="text-(--text-tertiary)">{label}</span>
      <span className="text-(--text-primary)">{value}</span>
    </span>
  );
}

export function LiveUpdateRow({ update: u }: { update: LiveUpdateRecord }) {
  const stats: { label: string; value: string }[] = [];
  if (u.noise_level) stats.push({ label: 'Noise', value: u.noise_level });
  if (u.seating_availability) stats.push({ label: 'Seating', value: u.seating_availability });
  if (u.temperature) stats.push({ label: 'Temp', value: u.temperature });
  if (u.outlets) stats.push({ label: 'Outlets', value: u.outlets });

  return (
    <li className="rounded-2xl border border-(--surface-border) bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-(--text-primary)">
            {u.place_label ?? u.place_id}
          </div>
          <div className="mt-0.5 text-[11px] text-(--text-tertiary)">
            {u.user_email ?? u.user_id} · {timeAgo(u.created_at)}
            {u.is_demo ? ' · demo' : ''}
          </div>
        </div>
        <Icon name="Broadcast" size={16} className="shrink-0 text-(--text-tertiary)" />
      </div>

      {stats.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      {u.rotating_question && u.rotating_answer && (
        <div className="mt-2 text-[12px] text-(--text-secondary)">
          <span className="text-(--text-tertiary)">{u.rotating_question}</span>{' '}
          <span className="text-(--text-primary)">{u.rotating_answer}</span>
        </div>
      )}
    </li>
  );
}
