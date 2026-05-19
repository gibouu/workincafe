'use client';

import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

export function StarRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: PhosphorIconName;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-(--divider) py-3 last:border-0">
      <div className="flex items-center gap-3">
        <Icon name={icon} size={20} className="text-(--text-secondary)" />
        <span className="text-[14px] text-(--text-primary)">{label}</span>
      </div>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className="p-1"
            aria-label={`${label} ${n} stars`}
          >
            <Icon
              name="Star"
              size={24}
              weight={n <= value ? 'fill' : 'regular'}
              className={n <= value ? 'text-accent-amber' : 'text-sys-gray-4'}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
