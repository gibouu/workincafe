import { Icon, type PhosphorIconName } from '@/components/icons/Icon';

export function VitalsTile({
  icon,
  label,
  value,
}: {
  icon: PhosphorIconName;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-white/70 p-3 flex flex-col gap-1">
      <Icon name={icon} size={22} className="text-[var(--text-primary)]" />
      <div className="text-[11px] text-[var(--text-secondary)] leading-none">{label}</div>
      <div className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight">{value}</div>
    </div>
  );
}
