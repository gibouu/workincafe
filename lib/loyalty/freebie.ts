import { haversineMeters } from '@/lib/geo';
import { FREEBIE_RADIUS_KM } from '@/lib/loyalty/points';

interface CandidatePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Pick a random nearby place the user has never bought from + never checked
 * in to. The user cannot specify the place — anti-platform.
 *
 * Returns null if no eligible place exists in the radius.
 */
export async function pickFreebiePlace(
  db: any,
  args: { user_id: string; near: { lat: number; lng: number } },
): Promise<CandidatePlace | null> {
  const radiusM = FREEBIE_RADIUS_KM * 1000;

  const { data: places, error: placesError } = await db
    .from('places')
    .select('id, name, lat, lng');
  if (placesError) throw placesError;
  if (!places) return null;

  const { data: bought, error: boughtError } = await db
    .from('deal_purchases')
    .select('place_id')
    .eq('user_id', args.user_id);
  if (boughtError) throw boughtError;

  const { data: checkedIn, error: checkedInError } = await db
    .from('checkins')
    .select('place_id')
    .eq('user_id', args.user_id);
  if (checkedInError) throw checkedInError;

  const visited = new Set<string>();
  for (const row of (bought ?? []) as { place_id: string }[]) visited.add(row.place_id);
  for (const row of (checkedIn ?? []) as { place_id: string }[]) visited.add(row.place_id);

  const eligible: CandidatePlace[] = [];
  for (const p of places as CandidatePlace[]) {
    if (visited.has(p.id)) continue;
    const meters = haversineMeters({ lat: p.lat, lng: p.lng }, args.near);
    if (meters > radiusM) continue;
    eligible.push(p);
  }

  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)];
}
