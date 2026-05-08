/**
 * Brand → bucket lookup for OSM `amenity=fast_food` re-classification.
 * Source: docs/category-audit-2026-05.md (issue #79).
 *
 * Drives:
 *   - scripts/seed-osm.ts          — categorises new seed rows.
 *   - supabase/scripts/split-fast-food.sql — one-shot backfill of existing
 *     `category='fast_food'` rows.
 *
 * Keep the SQL script's `(values …)` clauses in sync with these sets.
 *
 * Categorisation rule (per #80 spec):
 *   - Brand in BURGER set        → `fast_food_burger` (hidden by default)
 *   - Brand in FAST_CASUAL set   → `restaurant`       (visible when restaurant filter is on)
 *   - Brand absent / unmatched   → `fast_food_burger` (safer default per spec)
 *
 * Brand strings are lowercased + trimmed before comparison.
 */

/** Burger / fried-chicken / pizza / sub / dessert / food-court chains.
 *  Hidden by default — nobody opens the app to find a McDonald's. */
export const FAST_FOOD_BURGER_BRANDS = new Set<string>([
  // Burger / fried-chicken
  "mcdonald's",
  'burger king',
  'kfc',
  'popeyes',
  "wendy's",
  "harvey's",
  'a&w',
  'five guys',
  'taco bell',
  "mary brown's",
  'chick-fil-a',
  'hero certified burgers',
  'south street burger',
  "the burger's priest",
  'shake shack',
  'jollibee',
  "church's chicken",
  'fat bastard burrito',
  "osmow's",
  // Subs
  'subway',
  'mr. sub',
  'quiznos',
  'firehouse subs',
  // Pizza
  'pizza pizza',
  'pizza nova',
  "domino's",
  'pizzaville',
  '241 pizza',
  "papa john's",
  "gino's pizza",
  'pizza depot',
  'pizzaiolo',
  'panago',
  'little caesars',
  // Asian / Mediterranean food-court chains
  'thaï express',
  'sushi shop',
  "mac's sushi",
  'edo japan',
  'manchu wok',
  'bourbon st. grill',
  'teriyaki experience',
  'jimmy the greek',
  'shanghai 360',
  'villa madina',
  "ali baba's",
  'wing machine',
  'chungchun rice dog',
  // Dessert / juice / popcorn / pretzel
  'krispy kreme',
  'cinnabon',
  'mr. pretzels',
  'kernels popcorn',
  'booster juice',
  'jugo juice',
  'freshly squeezed',
  'new york fries',
  'cultures',
  // French specifics
  "o'tacos",
  'pomme de pain',
  'la croissanterie',
  'bagelstein',
  "class'croute",
  'novettino',
  'g la dalle',
  'pita land',
  // Big-box food-courts
  'ikea',
  'costco',
]);

/** Fast-casual chains. Healthy bowls / burritos / poke / juice — places
 *  people actually open laptops in. Promoted to `restaurant`. */
export const FAST_CASUAL_BRANDS = new Set<string>([
  'chipotle',
  'freshii',
  'pita pit',
  'exki',
  'cojean',
  'poke house',
  'pokawa',
  'oakberry açaí bowls',
  'pitaya',
  'big fernand',
  'côté sushi',
  'chamas tacos',
  'burrito boyz',
  'mucho burrito',
  'quesada',
  'barburrito',
  "tahini's",
  'california sandwiches',
  'basil box',
]);

/** Returns the post-split category for an OSM `amenity=fast_food` row.
 *  Brand string is normalised (lowercase, trim) before lookup. */
export function bucketForFastFoodBrand(
  brand: string | null | undefined,
): 'fast_food_burger' | 'restaurant' {
  if (!brand) return 'fast_food_burger';
  const norm = brand.toLowerCase().trim();
  if (FAST_CASUAL_BRANDS.has(norm)) return 'restaurant';
  // BURGER set membership and the unmatched default both resolve to the
  // same bucket — no need to test both.
  return 'fast_food_burger';
}
