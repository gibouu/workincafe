import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    place_id?: string;
    avg_db?: number;
    peak_db?: number;
    duration_seconds?: number;
    device_model?: string;
  } | null;
  if (!body?.place_id || typeof body.avg_db !== 'number') {
    return NextResponse.json({ error: 'place_id and avg_db required' }, { status: 400 });
  }

  // Rate limit: 3 decibel tests per user per hour
  const hourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await supabase
    .from('decibel_samples')
    .select('id', { head: true, count: 'exact' })
    .eq('user_id', user.id)
    .gte('created_at', hourAgo);
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'three decibel tests per hour' }, { status: 429 });
  }

  const { data, error } = await supabase
    .from('decibel_samples')
    .insert({
      place_id: body.place_id,
      user_id: user.id,
      avg_db: body.avg_db,
      peak_db: body.peak_db ?? null,
      duration_seconds: body.duration_seconds ?? null,
      device_model: body.device_model ?? null,
    })
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
