import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getDemoSessionFromRequest } from '@/lib/demo/auth';
import { CITIES, findPlace } from '@/lib/demo/cities';

type Actor =
  | {
      id: string;
      email: string | null;
      name: string | null;
      isDemo: boolean;
    }
  | null;

export async function getRequestActor(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return {
      db: supabase,
      supabase,
      user: {
        id: user.id,
        email: user.email ?? null,
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        isDemo: false,
      } satisfies Exclude<Actor, null>,
      isDemo: false,
    };
  }

  const demo = await getDemoSessionFromRequest(request);
  if (demo) {
    return {
      db: createAdminClient(),
      supabase,
      user: {
        id: demo.userId,
        email: demo.email,
        name: demo.name,
        isDemo: true,
      } satisfies Exclude<Actor, null>,
      isDemo: true,
    };
  }

  return { db: supabase, supabase, user: null as Actor, isDemo: false };
}

function withDemoFlag<T extends Record<string, unknown>>(payload: T, isDemo: boolean) {
  return isDemo ? { ...payload, is_demo: true } : payload;
}

function isMissingDemoColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === '42703' || /is_demo/i.test(maybe.message ?? '');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function insertWithDemoFlag(
  db: any,
  table: string,
  payload: Record<string, unknown>,
  isDemo: boolean,
) {
  const first = await db
    .from(table)
    .insert(withDemoFlag(payload, isDemo))
    .select('id')
    .maybeSingle();

  if (first.error && isDemo && isMissingDemoColumn(first.error)) {
    return db.from(table).insert(payload).select('id').maybeSingle();
  }

  return first;
}

export async function upsertWithDemoFlag(
  db: any,
  table: string,
  payload: Record<string, unknown>,
  options: Record<string, unknown>,
  isDemo: boolean,
) {
  const first = await db.from(table).upsert(withDemoFlag(payload, isDemo), options);

  if (first.error && isDemo && isMissingDemoColumn(first.error)) {
    return db.from(table).upsert(payload, options);
  }

  return first;
}

export async function resolvePlaceIdForActor(db: any, placeId: string, isDemo: boolean) {
  if (!isDemo || isUuid(placeId)) return placeId;

  const demoPlace = findPlace(placeId);
  if (!demoPlace) return placeId;

  const normalizedNameHash = `demo:${demoPlace.id}`;
  const existing = await db
    .from('places')
    .select('id')
    .eq('normalized_name_hash', normalizedNameHash)
    .maybeSingle();
  if (existing.data?.id) return existing.data.id;

  const city = Object.values(CITIES).find((meta) =>
    meta.places.some((place) => place.id === demoPlace.id),
  );
  const payload = {
    name: demoPlace.name,
    address: demoPlace.address,
    city: city?.label ?? null,
    country: city?.country ?? null,
    neighborhood: demoPlace.neighborhood,
    lat: demoPlace.lat,
    lng: demoPlace.lng,
    category: demoPlace.category,
    normalized_name_hash: normalizedNameHash,
  };

  let inserted = await db
    .from('places')
    .insert({ ...payload, is_demo: true })
    .select('id')
    .maybeSingle();

  if (inserted.error && isMissingDemoColumn(inserted.error)) {
    inserted = await db.from('places').insert(payload).select('id').maybeSingle();
  }

  if (inserted.error || !inserted.data?.id) return placeId;

  const sourceRef = {
    place_id: inserted.data.id,
    normalized_name_hash: normalizedNameHash,
    source: 'user_submitted',
    external_id: normalizedNameHash,
  };
  const refResult = await db
    .from('place_source_refs')
    .upsert({ ...sourceRef, is_demo: true }, { onConflict: 'source,external_id' });
  if (refResult.error && isMissingDemoColumn(refResult.error)) {
    await db.from('place_source_refs').upsert(sourceRef, { onConflict: 'source,external_id' });
  }

  return inserted.data.id;
}
