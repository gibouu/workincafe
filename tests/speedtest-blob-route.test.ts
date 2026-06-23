import { describe, expect, it } from 'vitest';

const load = () => import('@/app/api/speedtest/blob/route');

describe('GET /api/speedtest/blob', () => {
  it('rejects invalid size values instead of starting an endless stream', async () => {
    const { GET } = await load();
    const res = await GET(new Request('http://test.local/api/speedtest/blob?size=not-a-number'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'size must be a number from 1 to 20' });
    expect(res.headers.get('content-length')).toBeNull();
  });
});
