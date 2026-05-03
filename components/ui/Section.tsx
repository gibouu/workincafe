'use client';

export function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
      <div className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</div>
      {subtitle && (
        <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{subtitle}</p>
      )}
      <div className="mt-2">{children}</div>
    </section>
  );
}
