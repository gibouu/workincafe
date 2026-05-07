import { NextResponse, type NextRequest } from 'next/server';
import { verifyCronRequest } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { searchAssetsByFolder, destroyAssets } from '@/lib/cloudinary-admin';

// Daily prune of orphaned Cloudinary assets. See #62.
//
// Two folders are managed by this app:
//   reviews/<reviewId>      — review photos, recorded in `review_photos`
//   owner-menus/<placeId>   — owner menu uploads, recorded in `place_menus`
//
// On owner-menu / review-photo delete the DB row vanishes but the
// Cloudinary asset itself sticks around. Aborted upload paths leave
// orphans too. This cron walks both folders and destroys assets that:
//   - are older than ORPHAN_AGE_HOURS (avoid deleting an asset between
//     upload and DB-write), AND
//   - have no matching DB row.
//
// Hard caps stop a runaway run from trashing the account.

const ORPHAN_AGE_HOURS = 24;
const MAX_DELETES_PER_RUN = 500;
const PAGE_SIZE = 100; // matches Cloudinary's max-results default

interface PruneSummary {
  folder: 'reviews' | 'owner-menus';
  scanned: number;
  candidates: number;
  deleted: number;
  capped: boolean;
}

async function pruneFolder(
  folderPrefix: 'reviews/' | 'owner-menus/',
  table: 'review_photos' | 'place_menus',
  remainingBudget: number,
): Promise<PruneSummary> {
  const cutoffMs = Date.now() - ORPHAN_AGE_HOURS * 60 * 60 * 1000;
  const summary: PruneSummary = {
    folder: folderPrefix.replace('/', '') as 'reviews' | 'owner-menus',
    scanned: 0,
    candidates: 0,
    deleted: 0,
    capped: false,
  };

  const admin = createAdminClient();
  const orphanCandidates: string[] = [];

  for await (const page of searchAssetsByFolder(folderPrefix, PAGE_SIZE)) {
    summary.scanned += page.length;
    // Filter by age first — `created_at` is ISO string from Cloudinary.
    const oldEnough = page.filter((r) => Date.parse(r.created_at) < cutoffMs);
    if (oldEnough.length === 0) continue;

    // Look up which of the old-enough assets exist in the DB.
    const ids = oldEnough.map((r) => r.public_id);
    const { data, error } = await admin
      .from(table)
      .select('cloudinary_public_id')
      .in('cloudinary_public_id', ids);

    if (error) {
      // Demo-mode contract — missing table means everything looks
      // orphaned, but that's the operator's problem; just bail.
      const code = (error as { code?: string }).code ?? '';
      if (code === '42P01') return summary;
      continue;
    }

    const liveIds = new Set(
      ((data ?? []) as { cloudinary_public_id: string }[]).map(
        (r) => r.cloudinary_public_id,
      ),
    );
    for (const r of oldEnough) {
      if (!liveIds.has(r.public_id)) orphanCandidates.push(r.public_id);
    }
    if (orphanCandidates.length >= remainingBudget) break;
  }

  summary.candidates = orphanCandidates.length;
  if (orphanCandidates.length === 0) return summary;

  // Cap + chunk deletions (Cloudinary accepts up to 100 ids per call).
  const capped = orphanCandidates.slice(0, remainingBudget);
  if (capped.length < orphanCandidates.length) summary.capped = true;

  for (let i = 0; i < capped.length; i += 100) {
    const chunk = capped.slice(i, i + 100);
    summary.deleted += await destroyAssets(chunk);
  }
  return summary;
}

export async function POST(request: NextRequest) {
  if (!verifyCronRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET ||
    !(
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??
      process.env.CLOUDINARY_CLOUD_NAME
    )
  ) {
    return NextResponse.json(
      { error: 'cloudinary not configured' },
      { status: 503 },
    );
  }

  let budget = MAX_DELETES_PER_RUN;
  const reviews = await pruneFolder('reviews/', 'review_photos', budget);
  budget -= reviews.deleted;
  const menus = await pruneFolder('owner-menus/', 'place_menus', budget);

  return NextResponse.json({
    ok: true,
    cap: MAX_DELETES_PER_RUN,
    age_hours_threshold: ORPHAN_AGE_HOURS,
    summary: [reviews, menus],
  });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
