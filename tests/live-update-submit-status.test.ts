import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('live update submit status handling', () => {
  it('only treats OK and documented demo fallback responses as successful', async () => {
    const { isLiveUpdateSubmitSuccess } = await import(
      '@/lib/live-updates/submission-status'
    );

    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 200 }))).toBe(true);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 201 }))).toBe(true);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 404 }))).toBe(true);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 503 }))).toBe(true);

    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 400 }))).toBe(false);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 401 }))).toBe(false);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 429 }))).toBe(false);
    expect(isLiveUpdateSubmitSuccess(new Response(null, { status: 500 }))).toBe(false);
  });

  it('uses the shared success contract in direct submit and auth replay paths', () => {
    const sheetSource = readFileSync(
      join(process.cwd(), 'components', 'review', 'LiveUpdateSheet.tsx'),
      'utf8',
    );
    const mapPageSource = readFileSync(
      join(process.cwd(), 'app', '(map)', 'page.tsx'),
      'utf8',
    );

    expect(sheetSource).toContain('isLiveUpdateSubmitSuccess(resp)');
    expect(mapPageSource).toContain('isLiveUpdateSubmitSuccess(r)');
  });
});
