import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ReviewRow {
  id: string;
  overall_rating: number | null;
  wifi_rating: number | null;
  noise_rating: number | null;
  seating_rating: number | null;
  comment: string | null;
  geo_verified: boolean;
  created_at: string;
  users: { display_name: string | null } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: placeId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 5)));

  const supabase = await createClient();

  // Resolve demo-string IDs to real UUIDs via place_source_refs
  let resolvedId = placeId;
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) {
    const { data: ref } = await supabase
      .from('place_source_refs')
      .select('place_id')
      .eq('normalized_name_hash', `demo:${placeId}`)
      .maybeSingle();
    if (ref?.place_id) resolvedId = ref.place_id;
  }

  const { data, error } = await supabase
    .from('reviews')
    .select(
      'id, overall_rating, wifi_rating, noise_rating, seating_rating, comment, geo_verified, created_at, users(display_name)',
    )
    .eq('place_id', resolvedId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    const code = (error as { code?: string }).code ?? '';
    // Demo-mode contract: missing tables → empty array, not an error
    if (code === '42P01') return NextResponse.json({ reviews: [] });
    return NextResponse.json({ reviews: [] });
  }
  return NextResponse.json({ reviews: data ?? [] }, { status: 200 });
}
