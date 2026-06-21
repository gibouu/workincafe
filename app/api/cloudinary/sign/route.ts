import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor, isOwnerOf } from '@/lib/auth/request-actor';
import { signCloudinaryUpload, CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';
import { rateLimit } from '@/lib/rate-limit';

const ALLOWED_FOLDERS = /^(reviews|owner-menus)\/([A-Za-z0-9_-]+)$/;

function uploadPublicId() {
  return `upload-${crypto.randomUUID().replace(/-/g, '')}`;
}

function isMissingTable(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  return maybe.code === '42P01' || /relation .* does not exist/i.test(maybe.message ?? '');
}

/**
 * Issues a short-lived signature for a direct browser → Cloudinary upload.
 * The browser POSTs the signed params + the file to Cloudinary's edge; the
 * resulting `public_id` is then attached to the review via
 * `/api/reviews/[id]/photos`.
 *
 * We pin `resource_type=image` and require a folder so callers can't sneak
 * videos or raw assets onto our account.
 */
export async function POST(request: NextRequest) {
  if (!CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ error: 'cloudinary not configured' }, { status: 503 });
  }

  const { db, user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 30/min per user — generous (one full review with 4 photos = 4
  // signatures). Caps a runaway client from burning Cloudinary credits.
  const rl = rateLimit('cloudinary-sign', user.id, { capacity: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'too many requests' },
      { status: 429, headers: { 'retry-after': String(rl.retryAfterSec) } },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    folder?: string;
    public_id?: string;
  } | null;

  const folder = typeof body?.folder === 'string' ? body.folder : '';
  // Allowed folders:
  //   reviews/<reviewId>     — review photos (per-review folder)
  //   owner-menus/<placeId>  — owner menu uploads (per-place folder; #25)
  const folderMatch = folder.match(ALLOWED_FOLDERS);
  if (!folderMatch) {
    return NextResponse.json({ error: 'invalid folder' }, { status: 400 });
  }

  const [, scope, scopeId] = folderMatch;
  if (scope === 'reviews') {
    const { data, error } = await db
      .from('reviews')
      .select('user_id')
      .eq('id', scopeId)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ error: 'reviews table unavailable' }, { status: 503 });
      }
      return NextResponse.json(
        { error: error.message ?? 'could not verify review ownership' },
        { status: 500 },
      );
    }
    if ((data as { user_id?: string } | null)?.user_id !== user.id) {
      return NextResponse.json({ error: 'not allowed to upload to this review' }, { status: 403 });
    }
  } else {
    const owns = await isOwnerOf(db, scopeId, user.id);
    if (!owns) return NextResponse.json({ error: 'not an owner of this place' }, { status: 403 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = uploadPublicId();
  const params: Record<string, string | number> = {
    folder,
    overwrite: 'false',
    public_id: publicId,
    timestamp,
  };

  const signature = await signCloudinaryUpload(params, process.env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    folder,
    overwrite: false,
    public_id: publicId,
    resource_type: 'image',
  });
}
