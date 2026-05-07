import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';
import { createAdminClient } from '@/lib/supabase/admin';

const PUBLIC_ID_RE = /^owner-menus\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+$/;
const VERSION_RE = /^v?\d{1,16}$/;
const MAX_BYTES = 5 * 1024 * 1024;

interface Body {
  cloudinary_public_id?: string;
  cloudinary_version?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  label?: string | null;
  file_kind?: 'image' | 'pdf';
}

// Owner-uploaded menu attachments. POST records a Cloudinary reference
// after a direct browser upload. Ownership is verified server-side; RLS
// is the second layer. See #25.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { id: placeId } = await params;
  const owns = await isOwnerOf(db, placeId, user.id);
  if (!owns) return NextResponse.json({ error: 'not an owner of this place' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Body | null;
  if (
    !body ||
    typeof body.cloudinary_public_id !== 'string' ||
    !PUBLIC_ID_RE.test(body.cloudinary_public_id)
  ) {
    return NextResponse.json({ error: 'invalid cloudinary_public_id' }, { status: 400 });
  }
  if (body.cloudinary_version != null && !VERSION_RE.test(String(body.cloudinary_version))) {
    return NextResponse.json({ error: 'invalid cloudinary_version' }, { status: 400 });
  }
  if (typeof body.bytes === 'number' && body.bytes > MAX_BYTES) {
    return NextResponse.json({ error: 'menu too large' }, { status: 400 });
  }
  // Folder format is `owner-menus/<placeId>/<filename>` — refuse uploads
  // that target a different place's folder, even if RLS would catch it.
  const folderPrefix = `owner-menus/${placeId}/`;
  if (!body.cloudinary_public_id.startsWith(folderPrefix)) {
    return NextResponse.json({ error: 'cloudinary_public_id does not match place_id' }, { status: 400 });
  }

  const fileKind = body.file_kind === 'pdf' ? 'pdf' : 'image';

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('place_menus')
    .insert({
      place_id: placeId,
      label: body.label?.trim() || null,
      cloudinary_public_id: body.cloudinary_public_id,
      cloudinary_version: body.cloudinary_version ?? null,
      width: typeof body.width === 'number' ? body.width : null,
      height: typeof body.height === 'number' ? body.height : null,
      bytes: typeof body.bytes === 'number' ? body.bytes : null,
      file_kind: fileKind,
      created_by: user.id,
    })
    .select('id')
    .single();
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === '42P01') return NextResponse.json({ ok: true, id: null }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
