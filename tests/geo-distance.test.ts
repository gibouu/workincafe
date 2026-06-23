import { describe, expect, it } from 'vitest';

import { haversineKm } from '../lib/geo/distance';
import { haversineMeters } from '../lib/geo';

describe('haversine distance helpers', () => {
  it('returns finite distances for antipodal coordinates when rounding pushes the intermediate above one', () => {
    const a = { lat: -66.72440883748135, lng: 0.22089225395743028 };
    const b = { lat: 66.72440883752823, lng: -179.7791077460132 };

    const km = haversineKm(a.lat, a.lng, b.lat, b.lng);
    const meters = haversineMeters(a, b);

    expect(Number.isFinite(km)).toBe(true);
    expect(Number.isFinite(meters)).toBe(true);
    expect(km).toBeCloseTo(20015.0868, 4);
    expect(meters).toBeCloseTo(20015086.796, 1);
  });

  it('keeps ordinary coordinate distances unchanged', () => {
    const paris = { lat: 48.8566, lng: 2.3522 };
    const toronto = { lat: 43.6532, lng: -79.3832 };

    expect(haversineKm(paris.lat, paris.lng, toronto.lat, toronto.lng)).toBeCloseTo(
      6000.7587,
      4,
    );
    expect(haversineMeters(paris, toronto)).toBeCloseTo(6000758.677, 1);
  });
});
