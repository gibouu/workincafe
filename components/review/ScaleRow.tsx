'use client';

import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

export function ScaleRow({
  icon,
  label,
  lowLabel,
  highLabel,
  value,
  onChange,
}: {
  icon: PhosphorIconName;
  label: string;
  lowLabel: string;
  highLabel: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-(--divider) py-3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Icon name={icon} size={20} className="text-(--text-secondary)" />
          <span className="text-[14px] text-(--text-primary)">{label}</span>
        </div>
        {value > 0 && (
          <span className="text-[12px] text-(--text-secondary)">{value} / 5</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-14 text-[11px] text-(--text-tertiary)">{lowLabel}</span>
        <div className="flex flex-1 items-center justify-between gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = n <= value && value > 0;
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                aria-label={`${label} ${n} of 5`}
                className={`flex h-8 flex-1 items-center justify-center rounded-md transition ${
                  active ? 'bg-accent text-white' : 'bg-sys-gray-6 text-(--text-secondary) hover:bg-sys-gray-5'
                }`}
              >
                <span className="text-[11px] font-semibold">{n}</span>
              </button>
            );
          })}
        </div>
        <span className="w-14 text-right text-[11px] text-(--text-tertiary)">{highLabel}</span>
      </div>
    </div>
  );
}
