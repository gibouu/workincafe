import { describe, expect, it, vi } from 'vitest'
import { SEEDING_QUERY_TEMPLATES } from '@/lib/domain/seeding-queries'

// Tier 1 coverage for the GP-1 Text Search caller (obligations rows: IDs-only
// boundary at the caller; no-store fetches; accounting once per outbound
// attempt with no automatic retry). The module is server-only; fetch is mocked
// — no test contacts Google (harness rule #30).

vi.mock('server-only', () => ({}))

const { searchPlaceIdsForSeeding, TEXT_SEARCH_SKU } =
  await import('@/lib/integrations/google/server/places-text-search')

const TEMPLATE = SEEDING_QUERY_TEMPLATES[0]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('searchPlaceIdsForSeeding', () => {
  it('sends the IDs-only field mask, no-store, and the bounded query', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ places: [{ id: 'p1' }] }))
    const attempts: unknown[] = []
    const result = await searchPlaceIdsForSeeding(
      TEMPLATE,
      'test-key',
      async (a) => void attempts.push(a),
      fetchMock,
    )

    expect(result).toEqual({ status: 'ok', placeIds: ['p1'], attempts: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText')
    expect(init.cache).toBe('no-store')
    const headers = init.headers as Record<string, string>
    expect(headers['X-Goog-FieldMask']).toBe('places.id,nextPageToken')
    expect(headers['X-Goog-Api-Key']).toBe('test-key')
    const body = JSON.parse(init.body as string)
    expect(body.textQuery).toBe(TEMPLATE.textQuery)
    expect(body.locationRestriction.rectangle).toBeDefined()
  })

  it('retains ONLY Place IDs — every other response field is discarded', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        places: [
          { id: 'p1', displayName: { text: 'Leaky Cafe' }, rating: 4.7, location: { lat: 1 } },
        ],
        contextualContents: [{ text: 'should never escape' }],
      }),
    )
    const result = await searchPlaceIdsForSeeding(TEMPLATE, 'k', async () => {}, fetchMock)
    expect(result).toEqual({ status: 'ok', placeIds: ['p1'], attempts: 1 })
  })

  it('paginates with the page token and accounts one attempt per page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ places: [{ id: 'a' }], nextPageToken: 'tok-2' }))
      .mockResolvedValueOnce(jsonResponse({ places: [{ id: 'b' }] }))
    const attempts: Array<{ sku: string; resultsCount: number | null }> = []
    const result = await searchPlaceIdsForSeeding(
      TEMPLATE,
      'k',
      async (a) => void attempts.push(a),
      fetchMock,
    )
    expect(result).toEqual({ status: 'ok', placeIds: ['a', 'b'], attempts: 2 })
    expect(attempts).toHaveLength(2)
    expect(attempts.every((a) => a.sku === TEXT_SEARCH_SKU)).toBe(true)
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(secondBody.pageToken).toBe('tok-2')
  })

  it('caps pages per run (quota control)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ places: [{ id: 'x' }], nextPageToken: 'more' }),
    )
    const result = await searchPlaceIdsForSeeding(TEMPLATE, 'k', async () => {}, fetchMock)
    expect(result.status).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('a non-OK response is accounted and NEVER retried', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'denied' }, 403))
    const attempts: Array<{ httpStatus: number | null }> = []
    const result = await searchPlaceIdsForSeeding(
      TEMPLATE,
      'k',
      async (a) => void attempts.push(a),
      fetchMock,
    )
    expect(result).toEqual({ status: 'failed', attempts: 1, failedHttpStatus: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(attempts).toEqual([{ sku: TEXT_SEARCH_SKU, httpStatus: 403, resultsCount: null }])
  })

  it('a network failure is accounted and NEVER retried', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    const attempts: unknown[] = []
    const result = await searchPlaceIdsForSeeding(
      TEMPLATE,
      'k',
      async (a) => void attempts.push(a),
      fetchMock,
    )
    expect(result).toEqual({ status: 'failed', attempts: 1, failedHttpStatus: null })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(attempts).toHaveLength(1)
  })

  it('a malformed response body fails closed (accounted, no partial ids)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ places: [{ noId: true }] }))
    const result = await searchPlaceIdsForSeeding(TEMPLATE, 'k', async () => {}, fetchMock)
    expect(result.status).toBe('failed')
  })
})

describe('seeding query registry', () => {
  it('is bounded, documented, and unique', () => {
    expect(SEEDING_QUERY_TEMPLATES.length).toBeGreaterThan(0)
    expect(SEEDING_QUERY_TEMPLATES.length).toBeLessThanOrEqual(10)
    const ids = SEEDING_QUERY_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of SEEDING_QUERY_TEMPLATES) {
      expect(t.textQuery.length).toBeGreaterThan(10)
      expect(t.description.length).toBeGreaterThan(5)
    }
  })
})
