/**
 * Preliminary 1–10 rating for a place based on its category and brand.
 *
 * This is the "phonebook fix" — every seeded place gets a baseline so the
 * UI has something to show + sort on before any user reviews exist. The
 * synthetic review carries `source='system'` and `source_weight=0.5` so
 * a single real review immediately moves the score, and ten real reviews
 * dilute the baseline to ~5%.
 *
 * Numbers are honest defaults, not pretending to be data. Public libraries
 * really are great work spots; fast-food joints really aren't.
 */

const CATEGORY_BASELINE: Record<string, number> = {
  library: 8.5,
  coworking: 7.5,
  cafe: 7.0,
  bakery: 7.0,
  hotel: 6.5,
  restaurant: 6.0,
  fast_food: 5.5,
  other: 6.5,
};

// Chain overrides — keyed on lower-cased substring match of place.name.
// First match wins (so put more specific chains before generic ones).
// Sources: subjective fit-for-work consensus + reviewer experience; not
// pulled from any third-party API. Comfortable with being roughly right.
const CHAIN_OVERRIDES: { match: RegExp; rating: number; reason: string }[] = [
  // Coworking / aparthotel-style
  { match: /\bwework\b/i,           rating: 8.0, reason: 'WeWork' },
  { match: /\bspaces\b/i,           rating: 8.0, reason: 'Spaces' },
  { match: /\bregus\b/i,            rating: 7.5, reason: 'Regus' },
  { match: /\banticaf[eé]/i,        rating: 8.5, reason: 'Anticafé (designed for working)' },
  { match: /\bcitadines\b/i,        rating: 7.0, reason: 'Citadines' },

  // Independent specialty coffee tends to be quieter, design-forward
  { match: /\bblue\s+bottle\b/i,    rating: 7.5, reason: 'Blue Bottle' },
  { match: /\bintelligentsia\b/i,   rating: 7.5, reason: 'Intelligentsia' },
  { match: /\bstumptown\b/i,        rating: 7.5, reason: 'Stumptown' },
  { match: /\bbalzac/i,             rating: 7.5, reason: 'Balzac\'s' },
  { match: /\bdineen\b/i,           rating: 7.5, reason: 'Dineen' },
  { match: /\bjimmy\'?s\b/i,        rating: 7.5, reason: 'Jimmy\'s Coffee' },
  { match: /\bdark\s+horse\b/i,     rating: 7.5, reason: 'Dark Horse' },
  { match: /\bboot\s+caf[eé]/i,     rating: 8.0, reason: 'Boot Café' },
  { match: /\bten\s+belles\b/i,     rating: 7.5, reason: 'Ten Belles' },
  { match: /\bholybelly\b/i,        rating: 7.5, reason: 'Holybelly' },
  { match: /\bt[eé]lescope\b/i,     rating: 7.5, reason: 'Télescope' },

  // Major chains — popular, reliable, but generic
  { match: /\bstarbucks\b/i,        rating: 7.0, reason: 'Starbucks (chain)' },
  { match: /\bsecond\s+cup\b/i,     rating: 6.5, reason: 'Second Cup' },
  { match: /\bcosta\s+coffee\b/i,   rating: 7.0, reason: 'Costa Coffee' },
  { match: /\bcaff[eè]\s+nero\b/i,  rating: 6.5, reason: 'Caffè Nero' },
  { match: /\bcolumbus\s+caf[eé]/i, rating: 6.5, reason: 'Columbus Café' },
  { match: /\btim\s+hortons\b/i,    rating: 5.5, reason: 'Tim Hortons (busy/loud)' },
  { match: /\btims\b/i,             rating: 5.5, reason: 'Tim Hortons' },
  { match: /\bdunkin/i,             rating: 5.5, reason: 'Dunkin\'' },
  { match: /\bpret\s+a?\s*manger\b/i, rating: 6.5, reason: 'Pret a Manger' },
  { match: /\ble\s+pain\s+quotidien\b/i, rating: 7.0, reason: 'Le Pain Quotidien' },
  { match: /\bmaison\s+kayser\b/i,  rating: 7.0, reason: 'Maison Kayser' },
  { match: /\beric\s+kayser\b/i,    rating: 7.0, reason: 'Eric Kayser' },
  { match: /\bpoil[aâ]ne\b/i,       rating: 7.5, reason: 'Poilâne' },
  { match: /\bpaul\b/i,             rating: 6.5, reason: 'Paul (bakery chain)' },
  { match: /\bmie\s+c[aâ]line\b/i,  rating: 5.5, reason: 'La Mie Câline' },

  // Fast food / quick service
  { match: /\bmcdonald/i,           rating: 4.5, reason: 'McDonald\'s' },
  { match: /\bsubway\b/i,           rating: 4.5, reason: 'Subway' },
  { match: /\bkfc\b/i,              rating: 4.0, reason: 'KFC' },
  { match: /\bburger\s+king\b/i,    rating: 4.0, reason: 'Burger King' },

  // Hotel chains — lobby-as-workspace varies a lot
  { match: /\bfour\s+seasons\b/i,    rating: 7.5, reason: 'Four Seasons' },
  { match: /\bmarriott\b/i,          rating: 7.0, reason: 'Marriott' },
  { match: /\bhilton\b/i,            rating: 7.0, reason: 'Hilton' },
  { match: /\bhyatt\b/i,             rating: 7.0, reason: 'Hyatt' },
  { match: /\bhoxton\b/i,            rating: 8.0, reason: 'The Hoxton (lobby work-friendly)' },
  { match: /\bace\s+hotel\b/i,       rating: 8.0, reason: 'Ace Hotel' },
  { match: /\bholiday\s+inn\b/i,     rating: 6.0, reason: 'Holiday Inn' },
  { match: /\bbest\s+western\b/i,    rating: 5.5, reason: 'Best Western' },
  { match: /\bibis\b/i,              rating: 5.5, reason: 'ibis' },
  { match: /\bnovotel\b/i,           rating: 6.5, reason: 'Novotel' },
  { match: /\bmercure\b/i,           rating: 6.5, reason: 'Mercure' },
];

export interface BaselineRating {
  /** 1–10 rating to insert as overall_rating. */
  rating: number;
  /** Short explanation surfaced in the synthetic review's comment. */
  reason: string;
}

export function categoryBaseline(category: string, name: string): BaselineRating {
  for (const c of CHAIN_OVERRIDES) {
    if (c.match.test(name)) return { rating: c.rating, reason: c.reason };
  }
  const baseline = CATEGORY_BASELINE[category] ?? CATEGORY_BASELINE.other;
  return {
    rating: baseline,
    reason: `${category[0].toUpperCase()}${category.slice(1)} baseline`,
  };
}

/**
 * Quantize the rating to integer 1..10. Database constraint is integer.
 */
export function quantize(rating: number): number {
  return Math.max(1, Math.min(10, Math.round(rating)));
}
