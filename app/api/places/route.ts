import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PlaceCategory } from '@/lib/categories';

interface FullPlaceRow {
  id: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  country: string | null;
  category: PlaceCategory;
  lat: number;
  lng: number;
  brand: string | null;
  hours_json: { raw?: string } | null;
}

interface SlimPlaceRow {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  brand: string | null;
}

interface RatingRow {
  place_id: string;
  study_spot_rating: number | null;
  rating_count: number;
  user_rating_count: number;
}

const MAX_FULL = 2500;
const MAX_SLIM = 5000;

function parseBbox(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return null;
  return [w, s, e, n];
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const cityParam = (url.searchParams.get('city') ?? '').toLowerCase();
  const cityName = cityParam === 'paris' ? 'Paris' : cityParam === 'toronto' ? 'Toronto' : null;
  if (!cityName) {
    return NextResponse.json({ error: 'city must be paris or toronto' }, { status: 400 });
  }

  const bbox = parseBbox(url.searchParams.get('bbox'));
  const supabase = await createClient();

  // ── Slim, bbox-bounded path ────────────────────────────────────────────
  // Used by the map. Returns just enough to render a marker; full place
  // details are fetched on click via /api/places/[id]. Bbox ranges over
  // longitude (lng between W..E) and latitude (lat between S..N) — the
  // existing places_geom_idx covers this since lat/lng are also stored
  // alongside the generated geom.
  if (bbox) {
    const [w, s, e, n] = bbox;
    const { data, error } = await supabase
      .from('places')
      .select('id, name, category, lat, lng, brand')
      .eq('city', cityName)
      .gte('lng', w)
      .lte('lng', e)
      .gte('lat', s)
      .lte('lat', n)
      .limit(MAX_SLIM);
    if (error) {
      const code = (error as { code?: string }).code ?? '';
      if (code === '42P01') return NextResponse.json({ places: [] });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Fetch rating + user-review counts so the client can apply the
    // curated default override: cafés always show; restaurants bypass
    // the category gate iff they have a user review AND
    // `study_spot_rating >= 7.5`. Other categories never bypass. See #77.
    const slimPlaces = (data ?? []) as SlimPlaceRow[];
    interface SlimRatingRow {
      place_id: string;
      study_spot_rating: number | null;
      user_rating_count: number;
    }
    const ratingByPlace = new Map<string, SlimRatingRow>();
    if (slimPlaces.length > 0) {
      const { data: ratingRows } = await supabase
        .from('mv_place_ratings')
        .select('place_id, study_spot_rating, user_rating_count')
        .in('place_id', slimPlaces.map((p) => p.id))
        .limit(MAX_SLIM);
      for (const r of (ratingRows ?? []) as SlimRatingRow[]) {
        ratingByPlace.set(r.place_id, r);
      }
    }

    const out = slimPlaces.map((p) => {
      const r = ratingByPlace.get(p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        lat: p.lat,
        lng: p.lng,
        brand: p.brand,
        rating: r?.study_spot_rating ?? 0,
        has_user_reviews: (r?.user_rating_count ?? 0) > 0,
      };
    });
    // CDN caches the bbox response for 60 s and serves it stale up to 5 min
    // while revalidating. Place data only changes on seed/prune so this is
    // safe — first request hits the DB, the next 100 hit Vercel's edge.
    return NextResponse.json(
      { places: out, total: out.length, slim: true },
      { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  }

  // ── Full city dump (legacy / sidebar path) ─────────────────────────────
  const { data: rawPlaces, error: pErr } = await supabase
    .from('places')
    .select('id, name, address, neighborhood, city, country, category, lat, lng, brand, hours_json')
    .eq('city', cityName)
    .order('name', { ascending: true })
    .limit(MAX_FULL);

  if (pErr) {
    const code = (pErr as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ places: [] });
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }
  const places = (rawPlaces ?? []) as FullPlaceRow[];

  const { data: ratings } = await supabase
    .from('mv_place_ratings')
    .select('place_id, study_spot_rating, rating_count, user_rating_count')
    .in('place_id', places.map((p) => p.id))
    .limit(MAX_FULL);

  const ratingByPlace = new Map<string, RatingRow>();
  for (const r of (ratings ?? []) as RatingRow[]) ratingByPlace.set(r.place_id, r);

  const out = places.map((p) => {
    const r = ratingByPlace.get(p.id);
    return {
      id: p.id,
      name: p.name,
      address: p.address ?? '',
      neighborhood: p.neighborhood ?? '',
      category: p.category,
      lat: p.lat,
      lng: p.lng,
      brand: p.brand,
      rating: r?.study_spot_rating ?? 0,
      review_count: r?.rating_count ?? 0,
      user_review_count: r?.user_rating_count ?? 0,
      has_user_reviews: (r?.user_rating_count ?? 0) > 0,
      avg_spend_eur: 0,
      // Vitals come from reviews. Until anyone reviews this place, we
      // surface 'unknown' explicitly rather than guessing 'moderate'.
      wifi: 'unknown' as const,
      noise: 'unknown' as const,
      outlets: 'unknown' as const,
      seats: 'unknown' as const,
      lighting: 'unknown' as const,
      tabletime_hours: 0,
      right_now_noise: 'No recent live updates',
      right_now_seating: 'No recent live updates',
      hours_raw: p.hours_json?.raw ?? null,
    };
  });

  return NextResponse.json(
    { places: out, total: out.length },
    { headers: { 'cache-control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}
