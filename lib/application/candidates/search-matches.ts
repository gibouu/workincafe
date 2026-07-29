import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import {
  type OvertureSuggestionRow,
  selectOvertureSuggestions,
} from '@/lib/db/queries/candidate-queries'

// Use case: our-side match suggestions for human-confirmed candidate matching
// (Decision 9). The operator types what they see on the Google Maps outbound
// page; the search runs over OUR Overture staging index only. The query text
// is session-only (URL-committed by the GET form) and never persisted here.

const querySchema = z.string().trim().min(2).max(100)

export async function searchMatches(
  rawQuery: string,
  db: Db = getDb(),
): Promise<OvertureSuggestionRow[]> {
  const parsed = querySchema.safeParse(rawQuery)
  if (!parsed.success) return []
  // Escape ILIKE wildcards so the operator's text matches literally.
  const escaped = parsed.data.replace(/[\\%_]/g, '\\$&')
  return selectOvertureSuggestions(db, escaped)
}
