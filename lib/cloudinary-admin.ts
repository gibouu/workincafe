/**
 * Cloudinary Admin API helpers used by the orphaned-asset prune cron
 * (#62). The browser-facing `lib/cloudinary.ts` keeps URL building +
 * the upload signer; this module is **server-only** because it sends
 * the API key/secret via Basic auth.
 */

const SEARCH_URL = 'https://api.cloudinary.com/v1_1';

interface SearchResource {
  public_id: string;
  created_at: string;
}

interface SearchResponse {
  resources?: SearchResource[];
  next_cursor?: string | null;
  total_count?: number;
}

interface DestroyResponse {
  result?: string;
}

function basicAuth(): string | null {
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!key || !secret) return null;
  // btoa is fine here — server side, runs on Edge or Node.
  return 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
}

function cloudName(): string | null {
  return (
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_CLOUD_NAME ??
    null
  );
}

/**
 * Page through every image asset whose `folder:` matches the given
 * prefix. Yields one page at a time so the caller can cap total work.
 *
 * `prefix` is a Cloudinary search expression, e.g. `owner-menus/` or
 * `reviews/`. Trailing wildcard is implicit.
 */
export async function* searchAssetsByFolder(
  folderPrefix: string,
  pageSize = 100,
): AsyncGenerator<SearchResource[]> {
  const cloud = cloudName();
  const auth = basicAuth();
  if (!cloud || !auth) return;

  let cursor: string | null = null;
  do {
    const url = new URL(`${SEARCH_URL}/${cloud}/resources/search`);
    url.searchParams.set('expression', `folder:${folderPrefix}*`);
    url.searchParams.set('max_results', String(pageSize));
    if (cursor) url.searchParams.set('next_cursor', cursor);

    const resp = await fetch(url.toString(), {
      headers: { Authorization: auth, accept: 'application/json' },
    });
    if (!resp.ok) return;
    const data = (await resp.json()) as SearchResponse;
    yield data.resources ?? [];
    cursor = data.next_cursor ?? null;
  } while (cursor);
}

/**
 * Destroy a list of public_ids in a single call. Cloudinary caps batches
 * at 100 ids per request — caller must chunk. Returns the count of
 * successfully-destroyed assets.
 */
export async function destroyAssets(publicIds: string[]): Promise<number> {
  if (publicIds.length === 0) return 0;
  const cloud = cloudName();
  const auth = basicAuth();
  if (!cloud || !auth) return 0;

  const url = new URL(
    `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload`,
  );
  for (const id of publicIds) url.searchParams.append('public_ids[]', id);

  const resp = await fetch(url.toString(), {
    method: 'DELETE',
    headers: { Authorization: auth, accept: 'application/json' },
  });
  if (!resp.ok) return 0;
  const data = (await resp.json()) as { deleted?: Record<string, string> };
  if (!data.deleted) return 0;
  return Object.values(data.deleted).filter((v) => v === 'deleted').length;
}

/** Convenience: check if a single delete succeeded. Used for adhoc tests. */
export async function destroyOne(publicId: string): Promise<boolean> {
  const result = await destroyAssets([publicId]);
  return result > 0;
}

export type { SearchResource, SearchResponse, DestroyResponse };
