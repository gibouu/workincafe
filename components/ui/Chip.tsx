'use client';

export function Chip({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 snap-start rounded-full border px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${
        active
          ? 'border-transparent bg-accent text-white'
          : 'border-[var(--surface-border)] bg-white text-[var(--text-primary)] hover:bg-sys-gray-6'
      }`}
    >
      {label}
    </button>
  );
}
