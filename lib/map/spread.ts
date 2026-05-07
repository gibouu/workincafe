/**
 * Colocated-pin spread.
 *
 * At max zoom, places that share identical (or near-identical) coordinates
 * stack on the same screen pixel — only the top one is clickable. Supercluster
 * stops clustering past `maxZoom`, so we need a separate displacement step.
 *
 * `spreadColocated()` takes the unclustered point features at a given zoom,
 * groups them by a low-precision lat/lng grid cell (~5 m), and returns a map
 * from placeId → displaced `[lng, lat]` for any group with more than one
 * member. Singletons aren't displaced. See #17.
 */

import type { PointFeature } from 'supercluster';

interface PlaceProps {
  placeId: string;
}

export interface SpreadOptions {
  /** Minimum zoom at which displacement kicks in (below this, supercluster
   *  is doing the right thing already). Default 18. */
  minZoom?: number;
  /** Radius in metres at which spread points orbit the original centre.
   *  Default 5 — roughly 8 px at zoom 18. */
  radiusMeters?: number;
  /** Decimals of lat/lng used to bucket "same location". 4 dp ≈ 11 m, 5 dp
   *  ≈ 1 m. Default 5 dp so true duplicates and "1 m off" points group. */
  bucketDecimals?: number;
}

const DEFAULTS: Required<SpreadOptions> = {
  minZoom: 18,
  radiusMeters: 5,
  bucketDecimals: 5,
};

const METERS_PER_DEGREE_LAT = 111_320;

function bucketKey(lng: number, lat: number, dp: number): string {
  return `${lat.toFixed(dp)}:${lng.toFixed(dp)}`;
}

/**
 * Compute displaced coordinates for any group of colocated point features.
 * Returns a map from placeId → `[lng, lat]`. Members of singleton groups are
 * not present in the map; the caller falls back to the feature's original
 * coordinates.
 */
export function spreadColocated(
  features: PointFeature<PlaceProps>[],
  zoom: number,
  opts: SpreadOptions = {},
): Map<string, [number, number]> {
  const { minZoom, radiusMeters, bucketDecimals } = { ...DEFAULTS, ...opts };
  const out = new Map<string, [number, number]>();
  if (zoom < minZoom || features.length === 0) return out;

  const groups = new Map<string, PointFeature<PlaceProps>[]>();
  for (const f of features) {
    const [lng, lat] = f.geometry.coordinates;
    const k = bucketKey(lng, lat, bucketDecimals);
    const arr = groups.get(k);
    if (arr) arr.push(f);
    else groups.set(k, [f]);
  }

  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Use the first point's lat to scale the longitude offset locally —
    // close enough at metropolitan latitudes and avoids importing a full
    // geodesy lib for a 5 m offset.
    const [centerLng, centerLat] = list[0].geometry.coordinates;
    const latRad = (centerLat * Math.PI) / 180;
    const dLat = radiusMeters / METERS_PER_DEGREE_LAT;
    const dLng = radiusMeters / (METERS_PER_DEGREE_LAT * Math.max(0.0001, Math.cos(latRad)));
    for (let i = 0; i < list.length; i++) {
      const angle = (i * 2 * Math.PI) / list.length;
      const lng = centerLng + dLng * Math.cos(angle);
      const lat = centerLat + dLat * Math.sin(angle);
      out.set(list[i].properties.placeId, [lng, lat]);
    }
  }

  return out;
}
