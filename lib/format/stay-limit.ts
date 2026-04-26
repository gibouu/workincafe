export function formatStayLimit(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours)) return '—';
  if (hours >= 8) return 'All day';
  if (hours <= 0) return '—';
  return `${hours}h`;
}
