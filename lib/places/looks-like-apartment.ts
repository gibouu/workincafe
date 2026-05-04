/**
 * Heuristic filter for OSM-tagged "tourism=hotel" rows that are actually
 * apartment buildings or student housing.
 *
 * In Paris especially, OSM contributors sometimes tag bare "Résidence X"
 * apartment buildings as `tourism=hotel`. Toronto has the same pattern
 * with student-residence dormitories. These places aren't useful as work
 * spots — they're not lobbies you can sit in.
 *
 * Strategy: explicit allowlist for hotel keywords + chains, then drop on
 * apartment-building / student-housing patterns. Anything that doesn't
 * match either side keeps the default (include).
 *
 * @example  looksLikeApartmentBuilding('Hôtel Résidence Foch') // false (has Hôtel)
 * @example  looksLikeApartmentBuilding('Résidence Capitaine Paoli') // true
 * @example  looksLikeApartmentBuilding('Residence Inn - Marriott') // false (Inn / chain)
 * @example  looksLikeApartmentBuilding('Parkside Student Residence') // true
 * @example  looksLikeApartmentBuilding('Citadines Bastille') // false (chain)
 */

const HOTEL_KEYWORD = /\bhotel\b|\bhôtel\b|hôtel-|hotel-|\binn\b|aparthotel|apparthôtel|aparthôtel|appart-hôtel|appart'hôtel|hostel/i;
const KNOWN_APARTHOTEL_CHAINS =
  /citadines|adagio|orfea|pierre\s*&\s*vacances|maeva|residhome|appart'?\s*city|residence\s+inn|extended\s*stay/i;
const ACADEMIC_HOUSING =
  /student|university|college|dormitory|dorm\b|enseignants?-chercheurs|chercheurs|cit[ée]\s*universitaire|résidence\s+universitaire|residence\s+universitaire/i;
const BARE_RESIDENCE_PREFIX = /^\s*r[eé]sidence\s+/i;
const BARE_RESIDENCE_SUFFIX = /\sr[eé]sidence\s*$/i;

export function looksLikeApartmentBuilding(name: string): boolean {
  if (!name) return false;
  // Explicit keeps first.
  if (HOTEL_KEYWORD.test(name)) return false;
  if (KNOWN_APARTHOTEL_CHAINS.test(name)) return false;
  // Then drops.
  if (ACADEMIC_HOUSING.test(name)) return true;
  if (BARE_RESIDENCE_PREFIX.test(name)) return true;
  if (BARE_RESIDENCE_SUFFIX.test(name)) return true;
  return false;
}
