import { z } from 'zod'
import type { Db } from '@/lib/db/client'
import { getDb } from '@/lib/db/connection'
import { type AdminCafeRow, selectCafeById } from '@/lib/db/queries/admin-cafes'
import { selectCurrentAttributes, selectCurrentHours } from '@/lib/db/queries/published-cafes'
import type { WeeklyHoursV1 } from '@/lib/domain/hours'
import { buildAttributeDetails, type CafeAttributeDetails } from '@/lib/domain/place-view'

// Use case: one café's curation view for the operator console — the record in
// any publication/record state plus its current attribute details and hours.
// Callers must already be authorized as an operator.

const placeIdSchema = z.uuid()

export interface CafeCurationView {
  cafe: AdminCafeRow
  attributeDetails: CafeAttributeDetails
  hours: WeeklyHoursV1 | null
}

export async function getCafeCuration(
  placeId: string,
  db: Db = getDb(),
): Promise<CafeCurationView | null> {
  if (!placeIdSchema.safeParse(placeId).success) return null
  const cafe = await selectCafeById(db, placeId)
  if (!cafe) return null

  const attributeRows = await selectCurrentAttributes(db, [placeId])
  const hours = await selectCurrentHours(db, placeId)

  return { cafe, attributeDetails: buildAttributeDetails(attributeRows), hours }
}
