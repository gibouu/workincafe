/**
 * open-meteo WMO weather code → friendly string.
 * https://open-meteo.com/en/docs#weathervariables
 */
export function weatherCondition(code: number | null | undefined): string | null {
  if (code === null || code === undefined) return null;
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'mostly clear';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'foggy';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain showers';
  if (code === 85 || code === 86) return 'snow showers';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return null;
}
