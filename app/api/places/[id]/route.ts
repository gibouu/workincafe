import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: place, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (/relation .* does not exist/i.test(error.message)) {
      return NextResponse.json({ error: 'not migrated' }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!place) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [{ data: rating }, { data: liveStatus }] = await Promise.all([
    supabase.from('mv_place_ratings').select('*').eq('place_id', id).maybeSingle(),
    supabase.from('mv_current_live_status').select('*').eq('place_id', id).maybeSingle(),
  ]);

  return NextResponse.json({ place, rating: rating ?? null, liveStatus: liveStatus ?? null });
}
