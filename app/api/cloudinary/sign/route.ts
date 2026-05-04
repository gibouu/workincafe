import { NextResponse, type NextRequest } from 'next/server';
import { getRequestActor } from '@/lib/auth/request-actor';
import { signCloudinaryUpload, CLOUDINARY_CLOUD_NAME } from '@/lib/cloudinary';

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

  const { user } = await getRequestActor(request);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    folder?: string;
    public_id?: string;
  } | null;

  const folder = typeof body?.folder === 'string' ? body.folder : '';
  const allowedFolders = /^reviews\/[A-Za-z0-9_-]+$/;
  if (!allowedFolders.test(folder)) {
    return NextResponse.json({ error: 'invalid folder' }, { status: 400 });
  }

  const publicIdSafe = typeof body?.public_id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.public_id)
    ? body.public_id
    : '';

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    folder,
    timestamp,
  };
  if (publicIdSafe) params.public_id = publicIdSafe;

  const signature = await signCloudinaryUpload(params, process.env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    signature,
    timestamp,
    api_key: process.env.CLOUDINARY_API_KEY,
    cloud_name: CLOUDINARY_CLOUD_NAME,
    folder,
    public_id: publicIdSafe || undefined,
    resource_type: 'image',
  });
}
