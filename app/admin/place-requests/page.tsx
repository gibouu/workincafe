import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { DEMO_PLACE_REQUESTS } from '@/lib/demo/admin';
import { categoryMeta } from '@/lib/categories';

export default function PlaceRequestsPage() {
  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            Place requests
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[var(--text-primary)]">Pending</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          {DEMO_PLACE_REQUESTS.length} pending · demo data
        </p>

        <ul className="mt-6 flex flex-col gap-3">
          {DEMO_PLACE_REQUESTS.map((r) => {
            const meta = categoryMeta(r.category);
            return (
              <li
                key={r.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
                    style={{ background: meta.color }}
                  >
                    <Icon name={meta.icon} size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-[var(--text-primary)]">
                      {r.name}
                    </div>
                    <div className="text-[12px] text-[var(--text-secondary)]">
                      {meta.label} · {r.address} · submitted {r.submittedAgo}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                      {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · nearest existing place{' '}
                      {r.distanceToNearestMeters < 100 ? (
                        <span className="text-accent-red">{r.distanceToNearestMeters} m (possible duplicate)</span>
                      ) : (
                        <span>{r.distanceToNearestMeters} m</span>
                      )}
                      {' '}· by {r.submitterName}
                    </div>
                    {r.notes && (
                      <div className="mt-2 text-[13px] text-[var(--text-primary)]">{r.notes}</div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-accent-green py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-xl bg-accent-red py-2 text-[13px] font-semibold text-white hover:opacity-90 transition"
                  >
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
