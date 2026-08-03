import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { fetchVenuePage } = await import('@/lib/integrations/venue-site/server/fetch-page')

// Tier 1 coverage for the Decision 30 venue-page fetcher: one honest,
// bounded, no-retry GET of the café's own recorded website.

function htmlResponse(body: string, contentType = 'text/html; charset=utf-8'): Response {
  return new Response(body, { status: 200, headers: { 'Content-Type': contentType } })
}

describe('fetchVenuePage', () => {
  it('GETs the page no-store with an identifying User-Agent', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('<html></html>'))
    const result = await fetchVenuePage('https://cafe23.ca/', fetchImpl)
    expect(result.status).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://cafe23.ca/')
    expect(init.method).toBe('GET')
    expect(init.cache).toBe('no-store')
    expect((init.headers as Record<string, string>)['User-Agent']).toContain('WorkinCafe')
  })

  it('rejects non-http(s) and malformed URLs without fetching', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse(''))
    expect(await fetchVenuePage('ftp://x.example', fetchImpl)).toEqual({
      status: 'failed',
      httpStatus: null,
    })
    expect(await fetchVenuePage('not a url', fetchImpl)).toEqual({
      status: 'failed',
      httpStatus: null,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('reports non-HTML responses distinctly', async () => {
    const fetchImpl = vi.fn(async () => htmlResponse('{}', 'application/json'))
    expect(await fetchVenuePage('https://cafe23.ca/', fetchImpl)).toEqual({ status: 'not_html' })
  })

  it('fails closed on HTTP errors and network errors without retrying', async () => {
    const err = vi.fn(async () => new Response('', { status: 503 }))
    expect(await fetchVenuePage('https://cafe23.ca/', err)).toEqual({
      status: 'failed',
      httpStatus: 503,
    })
    expect(err).toHaveBeenCalledTimes(1)

    const boom = vi.fn(async () => {
      throw new Error('network')
    })
    expect(await fetchVenuePage('https://cafe23.ca/', boom)).toEqual({
      status: 'failed',
      httpStatus: null,
    })
    expect(boom).toHaveBeenCalledTimes(1)
  })
})
