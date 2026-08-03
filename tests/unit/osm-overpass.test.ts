import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { fetchNearbyOsmCafes } = await import('@/lib/integrations/osm/server/overpass')

// Tier 1 coverage for the Decision 29 Overpass caller: query shape, no-store
// live fetch, identifying User-Agent, single attempt (no retry), and tolerant
// element mapping (nodes and way centers, meta timestamps, missing tags).

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('fetchNearbyOsmCafes', () => {
  it('POSTs an around query for cafés and coffee shops with no-store and a User-Agent', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ elements: [] }))
    const result = await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    expect(result.status).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://overpass-api.de/api/interpreter')
    expect(init.method).toBe('POST')
    expect(init.cache).toBe('no-store')
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('WorkinCafe')
    const body = decodeURIComponent(String(init.body))
    expect(body).toContain('around:100,43.65,-79.38')
    expect(body).toContain('"amenity"="cafe"')
    expect(body).toContain('"shop"="coffee"')
    expect(body).toContain('out center meta')
  })

  it('maps nodes and way centers, keeping name/opening_hours/timestamp when present', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        elements: [
          {
            type: 'node',
            id: 123,
            lat: 43.651,
            lon: -79.381,
            timestamp: '2026-06-07T12:00:00Z',
            tags: { name: 'Snakes & Lattes', opening_hours: 'Mo-Su 11:00-23:00' },
          },
          {
            type: 'way',
            id: 456,
            center: { lat: 43.652, lon: -79.382 },
            tags: { name: 'Way Cafe' },
          },
          { type: 'relation', id: 789 },
          { type: 'node', id: 999, tags: { name: 'no coords' } },
        ],
      }),
    )
    const result = await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.elements).toEqual([
      {
        osmType: 'node',
        osmId: '123',
        name: 'Snakes & Lattes',
        openingHours: 'Mo-Su 11:00-23:00',
        latitude: 43.651,
        longitude: -79.381,
        lastEditedAt: '2026-06-07T12:00:00Z',
      },
      {
        osmType: 'way',
        osmId: '456',
        name: 'Way Cafe',
        openingHours: null,
        latitude: 43.652,
        longitude: -79.382,
        lastEditedAt: null,
      },
    ])
  })

  it('adds a wider same-name search when a name pattern is given', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ elements: [] }))
    await fetchNearbyOsmCafes(43.65, -79.38, 100, 'Cafe[^A-Za-z0-9]*23', fetchImpl)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    const body = decodeURIComponent(String(init.body))
    expect(body).toContain('"name"~"Cafe[^A-Za-z0-9]*23",i')
    expect(body).toContain('around:750')
  })

  it('omits the name selector without a pattern', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ elements: [] }))
    await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(decodeURIComponent(String(init.body))).not.toContain('"name"~')
  })

  it('fails closed on a non-OK response without retrying', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429))
    const result = await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    expect(result).toEqual({ status: 'failed', httpStatus: 429 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails closed on a network error without retrying', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('boom')
    })
    const result = await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    expect(result).toEqual({ status: 'failed', httpStatus: null })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('fails closed on a malformed body', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response('not json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    )
    const result = await fetchNearbyOsmCafes(43.65, -79.38, 100, null, fetchImpl)
    expect(result).toEqual({ status: 'failed', httpStatus: 200 })
  })
})
