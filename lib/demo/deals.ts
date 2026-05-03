/**
 * Hardcoded demo deals for a few demo places, so the place card shows what
 * deals will look like once real partners onboard. These are NEVER inserted
 * into the database; they render with a 'Preview' badge and the purchase
 * button opens an explainer modal — no QR is ever issued.
 */

export interface DemoDeal {
  id: string;          // synthetic, prefixed with 'demo:' so it can never collide with a real uuid
  place_id: string;
  title: string;
  description: string;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
}

export const DEMO_DEALS: DemoDeal[] = [
  {
    id: 'demo:ten-belles-pack',
    place_id: 'ten-belles',
    title: 'Coffee + croissant',
    description: 'Filter coffee + butter croissant. Available all day.',
    kind: 'single_use',
    pack_size: 1,
    price_cents: 600,
    currency: 'EUR',
  },
  {
    id: 'demo:ten-belles-15-pack',
    place_id: 'ten-belles',
    title: '15 coffees',
    description: 'A pack of 15 coffees to use whenever — your daily filter for two weeks.',
    kind: 'pack',
    pack_size: 15,
    price_cents: 4500,
    currency: 'EUR',
  },
  {
    id: 'demo:holybelly-5-pancakes',
    place_id: 'holybelly-5',
    title: 'Workday brunch',
    description: 'Stack of pancakes + flat white. Mon–Fri before noon.',
    kind: 'single_use',
    pack_size: 1,
    price_cents: 1500,
    currency: 'EUR',
  },
];

export function demoDealsForPlace(placeId: string): DemoDeal[] {
  return DEMO_DEALS.filter((d) => d.place_id === placeId);
}
