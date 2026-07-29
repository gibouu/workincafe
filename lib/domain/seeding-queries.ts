// The bounded, documented study-related query set for GP-1 seeding (Decision
// 9's confirmed workflow — "bounded, documented study-related Places Text
// Search queries"). This registry IS the approved set: a seeding run executes
// exactly one of these templates, recorded on the run by id. Changing or
// adding templates is a change to the confirmed workflow's inputs — deliberate,
// reviewed edits only, never dynamic or operator-typed query text.
//
// Every query is geographically restricted at request time to the launch
// service area's bounding box (Toronto) by the caller; template text stays
// city-qualified anyway so intent is documented and portable.

export interface SeedingQueryTemplate {
  id: string
  textQuery: string
  description: string
}

export const SEEDING_QUERY_TEMPLATES: readonly SeedingQueryTemplate[] = [
  {
    id: 'study-cafes',
    textQuery: 'cafes good for studying in Toronto',
    description: 'Core study-café intent.',
  },
  {
    id: 'laptop-work-cafes',
    textQuery: 'coffee shops to work on a laptop in Toronto',
    description: 'Laptop-work intent — surfaces work-friendly coffee shops.',
  },
  {
    id: 'wifi-cafes',
    textQuery: 'cafes with wifi in Toronto',
    description: 'Connectivity intent.',
  },
  {
    id: 'quiet-cafes',
    textQuery: 'quiet cafes in Toronto',
    description: 'Atmosphere intent — quieter venues suited to focus.',
  },
] as const

export function findSeedingTemplate(id: string): SeedingQueryTemplate | undefined {
  return SEEDING_QUERY_TEMPLATES.find((t) => t.id === id)
}

// Request-time geographic restriction for seeding queries: the City of Toronto
// bounding box (same box the ingestion runbook documents for the Overture
// extract). A rectangle restriction, not a polygon — the service-area polygon
// governs canonical membership at review time, not the provider query.
export const SEEDING_LOCATION_RESTRICTION = {
  low: { latitude: 43.581, longitude: -79.6393 },
  high: { latitude: 43.8555, longitude: -79.1156 },
} as const

// Quota controls (confirmed workflow: quota controls per run): pages are
// capped per run; each page is one accounted outbound attempt.
export const SEEDING_MAX_PAGES_PER_RUN = 3
export const SEEDING_PAGE_SIZE = 20

// Billable-call accounting record (Decision 16 — one per actual outbound
// attempt, success or failure; never auto-retried). Operational data only.
export interface OutboundAttempt {
  sku: string
  httpStatus: number | null
  resultsCount: number | null
}
