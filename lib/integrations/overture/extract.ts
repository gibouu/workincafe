import { z } from 'zod'
import {
  OVERTURE_ALTERNATE_CATEGORIES_MAX,
  OVERTURE_CATEGORY_MAX_LENGTH,
  OVERTURE_TEXT_MAX_LENGTH,
  type OvertureIndexRecord,
  overtureIndexRecordSchema,
} from '@/lib/domain/overture-index'

// Parses one line of an Overture "places" GeoJSONSeq extract (one GeoJSON
// Feature per line, as produced by the documented external extraction command —
// see docs/operations/ingestion.md) into the normalized matching-index record.
// Pure: no IO. External input is fully validated (Decision 19b); anything that
// does not yield a valid record becomes a typed skip, never a crash — a monthly
// refresh must not fail on one malformed row.

const rawFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: z.object({
    type: z.string(),
    coordinates: z.unknown(),
  }),
  properties: z.looseObject({
    id: z.string().optional(),
    names: z.looseObject({ primary: z.string().optional() }).optional(),
    categories: z
      .looseObject({
        primary: z.string().nullish(),
        alternate: z.array(z.string()).nullish(),
      })
      .nullish(),
    addresses: z.array(z.looseObject({ freeform: z.string().nullish() })).nullish(),
    websites: z.array(z.string()).nullish(),
    phones: z.array(z.string()).nullish(),
    confidence: z.number().nullish(),
  }),
})

export type ExtractLineResult =
  | { status: 'record'; record: OvertureIndexRecord }
  | { status: 'skipped'; reason: ExtractSkipReason }

export type ExtractSkipReason =
  'empty_line' | 'invalid_json' | 'not_a_point_feature' | 'missing_id_or_name' | 'invalid_record'

/** Parse one extract line. GERS id comes from properties.id (Overture places). */
export function parseExtractLine(line: string): ExtractLineResult {
  const trimmed = line.trim()
  if (trimmed === '') return { status: 'skipped', reason: 'empty_line' }

  let json: unknown
  try {
    json = JSON.parse(trimmed)
  } catch {
    return { status: 'skipped', reason: 'invalid_json' }
  }

  const feature = rawFeatureSchema.safeParse(json)
  if (!feature.success) return { status: 'skipped', reason: 'invalid_record' }

  const { geometry, properties } = feature.data
  if (geometry.type !== 'Point' || !Array.isArray(geometry.coordinates)) {
    return { status: 'skipped', reason: 'not_a_point_feature' }
  }
  const [longitude, latitude] = geometry.coordinates as unknown[]

  const gersId = properties.id
  const name = properties.names?.primary
  if (!gersId || !name) return { status: 'skipped', reason: 'missing_id_or_name' }

  // Optional fields degrade to absent rather than invalidating the record; only
  // structural problems (id/name/coordinates) skip it.
  const optionalText = (value: string | null | undefined, max: number) => {
    const v = value?.trim()
    return v && v.length <= max ? v : undefined
  }
  const candidate = {
    gersId,
    name,
    primaryCategory: optionalText(properties.categories?.primary, OVERTURE_CATEGORY_MAX_LENGTH),
    alternateCategories: (properties.categories?.alternate ?? [])
      .map((c) => optionalText(c, OVERTURE_CATEGORY_MAX_LENGTH))
      .filter((c): c is string => c !== undefined)
      .slice(0, OVERTURE_ALTERNATE_CATEGORIES_MAX),
    latitude,
    longitude,
    address: optionalText(properties.addresses?.[0]?.freeform, OVERTURE_TEXT_MAX_LENGTH),
    website: optionalText(properties.websites?.[0], OVERTURE_TEXT_MAX_LENGTH),
    phone: optionalText(properties.phones?.[0], OVERTURE_TEXT_MAX_LENGTH),
    confidence: properties.confidence ?? undefined,
  }

  const parsed = overtureIndexRecordSchema.safeParse(candidate)
  if (!parsed.success) return { status: 'skipped', reason: 'invalid_record' }
  return { status: 'record', record: parsed.data }
}
