import { describe, expect, it, vi } from 'vitest';
import type { DemoPlace } from '@/lib/demo/paris-places';

type PlaceTargetModule = {
  placeTargetIdFromSearch?: (search: string) => string | null;
  loadPlaceTarget?: (
    targetId: string,
    places: DemoPlace[],
    fetcher: typeof fetch,
  ) => Promise<DemoPlace | null>;
};

async function loadTargetModule(): Promise<PlaceTargetModule> {
  const modulePath = '@/app/(map)/place-target';
  return import(modulePath).catch(() => ({}));
}

function place(overrides: Partial<DemoPlace> = {}): DemoPlace {
  return {
    id: 'target-place',
    name: 'Target Cafe',
    address: '1 Test St',
    neighborhood: 'Test',
    country: 'CA',
    category: 'cafe',
    lat: 43.65,
    lng: -79.38,
    brand: null,
    rating: 8,
    review_count: 1,
    avg_spend_eur: 4,
    wifi: 'fast',
    noise: 'moderate',
    outlets: 'some',
    seats: 'some',
    lighting: 'good',
    tabletime_hours: 2,
    right_now_noise: 'Quiet',
    right_now_seating: 'Seats open',
    ...overrides,
  };
}

describe('map place target query handling', () => {
  it('reads a place id from the map query string', async () => {
    const mod = await loadTargetModule();

    expect(typeof mod.placeTargetIdFromSearch).toBe('function');
    expect(mod.placeTargetIdFromSearch?.('?place=cafe%20123')).toBe('cafe 123');
    expect(mod.placeTargetIdFromSearch?.('?place=')).toBeNull();
    expect(mod.placeTargetIdFromSearch?.('?other=cafe%20123')).toBeNull();
  });

  it('opens a target that is already in the map place list without fetching', async () => {
    const mod = await loadTargetModule();
    const target = place();
    const fetcher = vi.fn<typeof fetch>();

    const resolved = await mod.loadPlaceTarget?.(target.id, [target], fetcher);

    expect(resolved).toBe(target);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches a target by id when it is not already in the map place list', async () => {
    const mod = await loadTargetModule();
    const target = place({ id: 'live place' });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ place: target }), { status: 200 }),
    );

    const resolved = await mod.loadPlaceTarget?.(target.id, [], fetcher);

    expect(resolved).toEqual(target);
    expect(fetcher).toHaveBeenCalledWith('/api/places/live%20place');
  });
});
