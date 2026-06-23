import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('ReviewForm pending submit replay', () => {
  it('saves review content for auth replay without stale coordinates', () => {
    const source = readFileSync(
      join(process.cwd(), 'components', 'review', 'ReviewForm.tsx'),
      'utf8',
    );

    expect(source).toContain('const buildPendingPayload = () => {');
    expect(source).toContain('const { verified_lat: _verifiedLat, verified_lng: _verifiedLng, ...payload } = buildPayload();');
    expect(source).toContain("savePending('review', place.id, buildPendingPayload())");
    expect(source).not.toContain("savePending('review', place.id, buildPayload())");
  });
});
