/**
 * Country-code → currency-symbol lookup for the review form.
 *
 * Drives the per-place price display ("How much was your coffee?") so a
 * Tokyo café shows ¥, a London café shows £, etc. Replaces the legacy
 * `currencySymbol(cityForPlace(id))` lookup which only knew about Paris
 * and Toronto. See #118.
 */

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  // Eurozone (subset matching seeded cities)
  FR: '€',
  DE: '€',
  ES: '€',
  PT: '€',
  // Pound / dollar variants
  GB: '£',
  US: '$',
  CA: 'C$',
  AU: 'A$',
  NZ: 'NZ$',
  SG: 'S$',
  // Single-symbol currencies
  JP: '¥',
  KR: '₩',
  CH: 'CHF',
  TR: '₺',
  AE: 'AED',
  IS: 'kr',
  DK: 'kr',
};

/**
 * Resolve a country code to a display currency symbol. Unknown / null
 * country falls back to '$' — neutral default since the review form
 * needs *some* symbol to render.
 */
export function currencyForCountry(country: string | null | undefined): string {
  if (!country) return '$';
  return CURRENCY_BY_COUNTRY[country.toUpperCase()] ?? '$';
}
