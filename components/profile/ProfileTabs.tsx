'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { PARIS_DEMO_PLACES } from '@/lib/demo/paris-places';
import { categoryMeta } from '@/lib/categories';

type Tab = 'places' | 'reviews' | 'stats';

export function ProfileTabs() {
  const [tab, setTab] = useState<Tab>('places');
  const favorites = PARIS_DEMO_PLACES.slice(0, 3);

  return (
    <div>
      <div className="flex gap-1 rounded-2xl bg-sys-gray-6 p-1">
        <TabButton icon="Heart" label="My places" active={tab === 'places'} onClick={() => setTab('places')} />
        <TabButton
          icon="PencilSimple"
          label="Reviews"
          active={tab === 'reviews'}
          onClick={() => setTab('reviews')}
        />
        <TabButton
          icon="Medal"
          label="Stats"
          active={tab === 'stats'}
          onClick={() => setTab('stats')}
        />
      </div>

      <div className="mt-4">
        {tab === 'places' && (
          <ul className="flex flex-col gap-2">
            {favorites.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <li key={p.id}>
                  <Link
                    href={`/place/${p.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-3 shadow-card hover:bg-sys-gray-6 transition"
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-full text-white shadow-bubble"
                      style={{ background: meta.color }}
                    >
                      <Icon name={meta.icon} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                        {p.name}
                      </div>
                      <div className="truncate text-[12px] text-[var(--text-secondary)]">
                        {p.address} · {p.neighborhood}
                      </div>
                    </div>
                    <Icon name="Heart" weight="fill" size={16} className="text-accent-red" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {tab === 'reviews' && (
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)] shadow-card">
            No reviews yet. Drop by a place and leave the first one.
          </div>
        )}

        {tab === 'stats' && (
          <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                  Trust score
                </div>
                <div className="mt-1 text-[34px] font-bold text-[var(--text-primary)]">10</div>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-sys-gray-6 px-3 py-1.5 text-[12px] text-[var(--text-secondary)]">
                <Icon name="Medal" size={14} />
                <span>Newcomer</span>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-sys-gray-5">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: '10%' }}
              />
            </div>
            <div className="mt-2 text-[11px] text-[var(--text-tertiary)]">
              Reach 90 for the Veteran badge (top 10% per city).
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <Mini label="Reviews" value="0" />
              <Mini label="Check-ins" value="0" />
              <Mini label="Tests" value="0" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: PhosphorIconName;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition ${
        active
          ? 'bg-white text-[var(--text-primary)] shadow-sm'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon name={icon} size={14} weight={active ? 'fill' : 'regular'} />
      <span>{label}</span>
    </button>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-sys-gray-6 p-3 text-center">
      <div className="text-[17px] font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}
