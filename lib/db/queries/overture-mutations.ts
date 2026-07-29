import { sql } from 'drizzle-orm'
import type { OvertureIndexRecord } from '@/lib/domain/overture-index'
import type { Db } from '../client'

// Write path for the internal Overture matching index (slice 2). Refresh
// semantics: upsert by GERS id — a re-import updates basic facts and stamps the
// new source version; rows are never deleted by a refresh (stale rows remain
// identifiable by source_version; see docs/operations/ingestion.md).

export interface UpsertCounts {
  inserted: number
  updated: number
}

/** Upsert one batch of validated index records. Returns insert/update counts. */
export async function upsertOvertureRecords(
  db: Db,
  records: readonly OvertureIndexRecord[],
  sourceVersion: string,
): Promise<UpsertCounts> {
  if (records.length === 0) return { inserted: 0, updated: 0 }

  const rows = records.map(
    (r) => sql`(
      ${r.gersId}, ${r.name}, ${r.primaryCategory ?? null},
      ${JSON.stringify(r.alternateCategories)}::jsonb,
      ${r.latitude}, ${r.longitude},
      ${r.address ?? null}, ${r.website ?? null}, ${r.phone ?? null},
      ${r.confidence ?? null}, ${sourceVersion}
    )`,
  )

  const res = await db.execute<{ inserted: boolean }>(sql`
    INSERT INTO overture_places
      (gers_id, name, primary_category, alternate_categories, latitude, longitude,
       address, website, phone, confidence, source_version)
    VALUES ${sql.join(rows, sql`, `)}
    ON CONFLICT (gers_id) DO UPDATE SET
      name = EXCLUDED.name,
      primary_category = EXCLUDED.primary_category,
      alternate_categories = EXCLUDED.alternate_categories,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      address = EXCLUDED.address,
      website = EXCLUDED.website,
      phone = EXCLUDED.phone,
      confidence = EXCLUDED.confidence,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    RETURNING (xmax = 0) AS inserted
  `)

  let inserted = 0
  for (const row of res.rows) if (row.inserted) inserted += 1
  return { inserted, updated: res.rows.length - inserted }
}
