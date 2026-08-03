import 'server-only'

// Venue-website page fetcher (Decision 30): operator-triggered only, one page
// per click — the café's own recorded official website — never scheduled,
// never crawling. Honest User-Agent, bounded time and size, HTML only, single
// attempt with no retry. The response is handed to the pure structured-data
// extractor; no free-text scraping happens anywhere.

const USER_AGENT = 'WorkinCafe-curation/1.0 (https://github.com/gibouu/workincafe)'
const TIMEOUT_MS = 10_000
const MAX_HTML_CHARS = 2_000_000

export type VenuePageResult =
  | { status: 'ok'; html: string; finalUrl: string }
  | { status: 'failed'; httpStatus: number | null }
  | { status: 'not_html' }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export async function fetchVenuePage(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<VenuePageResult> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { status: 'failed', httpStatus: null }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { status: 'failed', httpStatus: null }
  }

  let response: Response
  try {
    response = await fetchImpl(parsed.toString(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    })
  } catch {
    return { status: 'failed', httpStatus: null }
  }

  if (!response.ok) return { status: 'failed', httpStatus: response.status }
  const contentType = response.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml/.test(contentType)) return { status: 'not_html' }

  let html: string
  try {
    html = await response.text()
  } catch {
    return { status: 'failed', httpStatus: response.status }
  }
  return {
    status: 'ok',
    html: html.length > MAX_HTML_CHARS ? html.slice(0, MAX_HTML_CHARS) : html,
    finalUrl: response.url || parsed.toString(),
  }
}
