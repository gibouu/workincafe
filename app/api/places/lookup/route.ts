import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';

/**
 * Server proxy for Google Places API (New). Two modes:
 *
 *   GET /api/places/lookup?q=<query>&token=<sessionToken>
 *     → Autocomplete (New). Returns trimmed predictions.
 *
 *   GET /api/places/lookup?placeId=<id>&token=<sessionToken>
 *     → Place Details (New). Returns the trimmed payload AddPlaceSheet uses.
 *
 * Gated to authenticated users so the GOOGLE_PLACES_API_KEY isn't a free
 * public proxy. Returns 503 with a clear message when the key is missing,
 * so the UI can degrade to manual entry.
 *
 * Session token: Google bills Autocomplete + the matching Details call as
 * one session when the same opaque token is sent on both requests. The
 * client generates a UUID per add-place flow and passes it through.
 */

const PLACES_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACES_DETAILS_BASE = 'https://places.googleapis.com/v1/places';

interface AutocompletePrediction {
  placeId: string;
  text: string;
  primary: string;
  secondary: string;
}

interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  types: string[];
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'lookup unavailable', detail: 'GOOGLE_PLACES_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token') ?? '';
  const placeId = searchParams.get('placeId');

  if (placeId) {
    return await placeDetails(apiKey, token, placeId);
  }

  const q = searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] satisfies AutocompletePrediction[] });
  }
  return await autocomplete(apiKey, token, q);
}

async function autocomplete(apiKey: string, token: string, q: string): Promise<NextResponse> {
  const body: Record<string, unknown> = {
    input: q,
    includedPrimaryTypes: ['cafe', 'restaurant', 'bakery', 'library', 'lodging'],
    languageCode: 'en',
  };
  if (token) body.sessionToken = token;

  const resp = await fetch(PLACES_AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: 'autocomplete failed', status: resp.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text?: string };
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };
  const predictions: AutocompletePrediction[] = (data.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .map((p) => ({
      placeId: p.placeId,
      text: p.text?.text ?? '',
      primary: p.structuredFormat?.mainText?.text ?? '',
      secondary: p.structuredFormat?.secondaryText?.text ?? '',
    }));
  return NextResponse.json({ predictions });
}

async function placeDetails(apiKey: string, token: string, placeId: string): Promise<NextResponse> {
  const url = new URL(`${PLACES_DETAILS_BASE}/${encodeURIComponent(placeId)}`);
  if (token) url.searchParams.set('sessionToken', token);
  const resp = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types',
    },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return NextResponse.json(
      { error: 'details failed', status: resp.status, detail: text.slice(0, 300) },
      { status: 502 },
    );
  }
  const data = (await resp.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    types?: string[];
  };
  if (!data.location || typeof data.location.latitude !== 'number' || typeof data.location.longitude !== 'number') {
    return NextResponse.json({ error: 'no location' }, { status: 502 });
  }
  const out: PlaceDetails = {
    placeId: data.id ?? placeId,
    name: data.displayName?.text ?? '',
    address: data.formattedAddress ?? '',
    lat: data.location.latitude,
    lng: data.location.longitude,
    types: data.types ?? [],
  };
  return NextResponse.json(out);
}
