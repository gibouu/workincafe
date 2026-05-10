import { notFound } from 'next/navigation';
import { findPlace } from '@/lib/demo/cities';
import { createClient } from '@/lib/supabase/server';
import { ReviewForm } from '@/components/review/ReviewForm';
import type { DemoPlace } from '@/lib/demo/paris-places';

export default async function NewReviewPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = await params;
  // Fast path: demo arrays.
  let place: DemoPlace | undefined = findPlace(placeId);
  // Fallback: live Supabase row (#118 — demo arrays only cover Paris +
  // Toronto, but reviews can target any seeded city).
  if (!place) {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('places')
      .select('id, name, address, neighborhood, country, category, lat, lng, brand, hours_json')
      .eq('id', placeId)
      .maybeSingle();
    if (row) {
      const r = row as {
        id: string;
        name: string;
        address: string | null;
        neighborhood: string | null;
        country: string | null;
        category: DemoPlace['category'];
        lat: number;
        lng: number;
        brand: string | null;
        hours_json: { raw?: string } | null;
      };
      place = {
        id: r.id,
        name: r.name,
        address: r.address ?? '',
        neighborhood: r.neighborhood ?? '',
        country: r.country,
        category: r.category,
        lat: r.lat,
        lng: r.lng,
        brand: r.brand,
        rating: 0,
        review_count: 0,
        avg_spend_eur: 0,
        wifi: 'unknown',
        noise: 'unknown',
        outlets: 'unknown',
        seats: 'unknown',
        lighting: 'unknown',
        tabletime_hours: 0,
        right_now_noise: 'No recent live updates',
        right_now_seating: 'No recent live updates',
        hours_raw: r.hours_json?.raw ?? null,
      };
    }
  }
  if (!place) notFound();

  return <ReviewForm place={place} />;
}
