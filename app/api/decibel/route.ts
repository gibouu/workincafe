import { NextResponse, type NextRequest } from 'next/server';
import {
  getRequestActor,
  insertWithDemoFlag,
  resolvePlaceIdForActor,
} from '@/lib/auth/request-actor';

function isMissingSchemaError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code ?? '';
  const message = (error as { message?: string }).message ?? '';
  return (
    code === '42P01' ||
    code === '42703' ||
    code === '42883' ||
    code === 'PGRST202' ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message) ||
    /function .* does not exist/i.test(message) ||
    /could not find .*function/i.test(message)
  );
}

export async function POST(request: NextRequest) {
  const { db, user, isDemo } = await getRequestActor(request);
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
  const placeId = await resolvePlaceIdForActor(db, body.place_id, isDemo);

  if (!isDemo) {
    const { data, error } = await db.rpc('submit_decibel_sample_rate_limited', {
      p_place_id: placeId,
      p_avg_db: body.avg_db,
      p_peak_db: body.peak_db ?? null,
      p_duration_seconds: body.duration_seconds ?? null,
      p_device_model: body.device_model ?? null,
    });

    if (error) {
      const message = (error as { message?: string }).message ?? '';
      if (isMissingSchemaError(error)) {
        return NextResponse.json({ error: 'table missing' }, { status: 503 });
      }
      return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
    }

    const inserted = Array.isArray(data) ? data[0] : data;
    if (!inserted?.inserted) {
      return NextResponse.json({ error: 'three decibel tests per hour' }, { status: 429 });
    }

    return NextResponse.json({ id: inserted.id });
  }

  const { data, error } = await insertWithDemoFlag(
    db,
    'decibel_samples',
    {
      place_id: placeId,
      user_id: user.id,
      avg_db: body.avg_db,
      peak_db: body.peak_db ?? null,
      duration_seconds: body.duration_seconds ?? null,
      device_model: body.device_model ?? null,
    },
    isDemo,
  );

  if (error) {
    const message = (error as { message?: string }).message ?? '';
    if (isMissingSchemaError(error)) {
      return NextResponse.json({ error: 'table missing' }, { status: 503 });
    }
    return NextResponse.json({ error: message || 'insert failed' }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
