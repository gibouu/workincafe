import { notFound } from 'next/navigation';
import { findPlace } from '@/lib/demo/cities';
import { createClient } from '@/lib/supabase/server';
import { ClaimWizard } from '@/components/claim/ClaimWizard';
import type { DemoPlace } from '@/lib/demo/paris-places';

export const metadata = { title: 'Claim this place · Work in Cafe' };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Fast path: demo arrays (Paris + Toronto curated set).
  let place: DemoPlace | undefined = findPlace(id);
  // Fallback: live Supabase row. Without this the claim flow 404'd for
  // every non-demo place — i.e. the entire 60k seeded global set after
  // #114. See #138.
  if (!place) {
    const supabase = await createClient();
    const { data: row } = await supabase
      .from('places')
      .select('id, name, address, neighborhood, country, category, lat, lng, brand, hours_json')
      .eq('id', id)
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
  return <ClaimWizard place={place} />;
}
