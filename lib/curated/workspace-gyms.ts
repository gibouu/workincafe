/**
 * Curated workspace-gym list (#127).
 *
 * A class of work-spot that doesn't fit OSM's tagging schema: luxury
 * gyms / private clubs / member spaces with publicly- or member-only
 * work areas. They live outside our seed (no `amenity=cafe`), so we
 * hand-curate them here.
 *
 * Each entry becomes a `places` row when `npm run seed:curated` runs.
 * Category defaults to `coworking` (best match — you go there to
 * work). `membership_required` is the human-readable note surfaced
 * on the place card.
 *
 * To add a new place:
 *   1. Find the lat/lng (Google Maps right-click → copy coords).
 *   2. Decide the membership note — keep it concise and accurate.
 *      Examples:
 *        - "Members only"
 *        - "Café area open to all; gym is members-only"
 *        - "Day pass available"
 *   3. Append a row below.
 *   4. Run `npm run seed:curated`.
 *
 * Idempotent: re-runs upsert on normalized_name_hash.
 */
import type { PlaceCategory } from '@/lib/categories';

export interface CuratedWorkspace {
  /** Human-readable name as it should appear on the place card. */
  name: string;
  address: string;
  city: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  lat: number;
  lng: number;
  /** Defaults to 'coworking' if omitted — most curated entries fit. */
  category?: PlaceCategory;
  /** Optional brand string for the place card monogram. */
  brand?: string;
  /** Human-readable paywall note. Surfaced as a badge on the card.
   *  Keep concise (~40 chars). NULL/undefined = no paywall — only
   *  add such rows to this file if they belong here for another
   *  reason (e.g. a sports center with a free work-friendly café). */
  membership_required?: string;
  /** Optional URL the user can visit to learn about membership. */
  website?: string;
  /** Optional notes for ops — not surfaced in the UI. */
  notes?: string;
}

/**
 * The curated list. Empty by default — fill in per-city as the project
 * scales. Paris + Toronto are the pilot scope per #127.
 *
 * Suggested first entries (off the top of head — verify lat/lng before
 * shipping):
 *
 *   Paris:
 *     - Annette K (sports complex, 75015 — café open to all, gym
 *       members-only). lat 48.842883, lng 2.2729411 — already in
 *       place_requests; once approved, this curation could link to it.
 *     - Soho House Paris (members only)
 *     - The Standard Hotel co-work
 *
 *   Toronto:
 *     - Verity Club (members only)
 *     - University Club of Toronto (members only)
 *     - The Spoke Club (members only)
 *
 * Don't seed without verifying each row — wrong coords or stale
 * membership info is worse than missing data.
 */
export const CURATED_WORKSPACES: CuratedWorkspace[] = [
  // Paris pilot entries go here.
  // {
  //   name: 'Soho House Paris',
  //   address: '...',
  //   city: 'Paris',
  //   country: 'FR',
  //   lat: 0,
  //   lng: 0,
  //   category: 'coworking',
  //   membership_required: 'Members only',
  // },

  // Toronto pilot entries go here.
];
