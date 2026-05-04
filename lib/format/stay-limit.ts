export function formatStayLimit(hours: number | null | undefined): string {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return 'Unknown';
  if (hours >= 8) return 'All day';
  return `${hours}h`;
}
