import { findPlace } from '@/lib/demo/cities';
import type { DemoPlace } from '@/lib/demo/paris-places';

export function placeTargetIdFromSearch(search: string): string | null {
  const targetId = new URLSearchParams(search).get('place')?.trim();
  return targetId || null;
}

export async function loadPlaceTarget(
  targetId: string,
  places: DemoPlace[],
  fetcher: typeof fetch = fetch,
): Promise<DemoPlace | null> {
  const existing = places.find((place) => place.id === targetId);
  if (existing) return existing;

  const demoPlace = findPlace(targetId);
  if (demoPlace) return demoPlace;

  try {
    const resp = await fetcher(`/api/places/${encodeURIComponent(targetId)}`);
    if (!resp.ok) return null;
    const data = (await resp.json()) as { place?: DemoPlace };
    return data.place ?? null;
  } catch {
    return null;
  }
}
