'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Supercluster from 'supercluster';
import type { AnyProps, PointFeature, ClusterFeature } from 'supercluster';
import { Icon } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import { brandLogoFor } from '@/lib/brand-logos';
import { type DemoPlace } from '@/lib/demo/paris-places';
import { spreadColocated } from '@/lib/map/spread';

type PlaceProps = { placeId: string };

const TILE_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

// Soft sage. Visible enough to act as a landmark, calm enough not to fight
// with the orange place markers. Outline is a touch darker so polygons
// still read at zoom-out distances. See #102.
const PARK_GREEN = '#C7E5BB';
const PARK_GREEN_OUTLINE = '#9FCB8E';

function isParkLayer(id: string): boolean {
  // Substring match excluding the false positives ('parking_lot', 'parkway').
  // Catches every variant we've seen across OpenMapTiles-derived styles —
  // 'park', 'park_outline', 'park-fill', 'landuse-park', 'national_park'.
  return /park/i.test(id) && !/parking|parkway/i.test(id);
}

/** Walk the loaded style and re-paint anything that looks park-like in our
 *  brand green. Idempotent; safe to call again on style reloads. See #102. */
function tintParksGreen(map: maplibregl.Map): void {
  const layers = map.getStyle().layers ?? [];
  for (const layer of layers) {
    if (!isParkLayer(layer.id)) continue;
    try {
      if (layer.type === 'fill') {
        map.setPaintProperty(layer.id, 'fill-color', PARK_GREEN);
        map.setPaintProperty(layer.id, 'fill-opacity', 0.9);
      } else if (layer.type === 'line') {
        map.setPaintProperty(layer.id, 'line-color', PARK_GREEN_OUTLINE);
      }
    } catch {
      // Style schemas drift between providers — skip layers that don't
      // expose the paint property we expect rather than throwing.
    }
  }
}

// Major-landmark layers (#120). The OpenFreeMap positron style ships
// without a POI layer — perfect for the minimal aesthetic, but it
// leaves the user without the orientation-grade landmarks (Eiffel
// Tower, CN Tower, etc.). We add two layers on top of the OMT vector
// source: a small circle for the location and a small label.
const LANDMARK_FILL = '#8E44AD';
const LANDMARK_FILTER: maplibregl.FilterSpecification = [
  'all',
  // Top-tier rank only — keeps the map quiet. OMT ranks 1 = most
  // significant; 3 still surfaces top-of-mind landmarks per metro.
  ['<=', ['coalesce', ['get', 'rank'], 99], 3],
  ['match', ['coalesce', ['get', 'class'], ''],
    ['attraction', 'monument', 'memorial', 'castle', 'art_gallery'],
    true,
    false,
  ],
];

function addLandmarkLayers(map: maplibregl.Map): void {
  if (map.getLayer('wic-landmark-dot')) return;
  // The OpenFreeMap positron style names its OpenMapTiles source
  // 'openmaptiles' — guard so we don't throw on a different style.
  if (!map.getSource('openmaptiles')) return;

  try {
    map.addLayer({
      id: 'wic-landmark-dot',
      type: 'circle',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom: 11,
      filter: LANDMARK_FILTER,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 14, 5],
        'circle-color': LANDMARK_FILL,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.95,
      },
    });
    map.addLayer({
      id: 'wic-landmark-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      minzoom: 12,
      filter: LANDMARK_FILTER,
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-offset': [0, 0.9],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#3A3A40',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    });
  } catch {
    // Style schemas drift; if the OMT poi source-layer isn't present
    // (e.g. user-overridden NEXT_PUBLIC_MAP_STYLE_URL), skip gracefully.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

// Bubble HTML only depends on (category, brand, size) — not on the
// individual place — so cache the serialized markup. Without this,
// renderToStaticMarkup(<Icon />) runs per marker on every moveend
// rebuild, which is the main CPU cost while panning (#194).
const bubbleCache = new Map<string, string>();

function renderPlaceBubble(place: DemoPlace, size = 24): string {
  const meta = categoryMeta(place.category);
  const brand = brandLogoFor(place.name);
  const cacheKey = `${place.category}|${brand?.initials ?? ''}|${brand?.bg ?? ''}|${size}`;
  const cached = bubbleCache.get(cacheKey);
  if (cached) return cached;
  const bg = brand?.bg ?? meta.color;
  const fg = brand?.fg ?? '#fff';

  const iconSize = Math.round(size * 0.55);
  const initialsFontSize = brand
    ? brand.initials.length === 1
      ? Math.round(size * 0.45)
      : Math.round(size * 0.34)
    : 0;

  const innerMarkup = brand
    ? `<span style="font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;font-size:${initialsFontSize}px;font-weight:700;letter-spacing:-0.01em;color:${fg};">${escapeHtml(brand.initials)}</span>`
    : renderToStaticMarkup(
        <Icon name={meta.icon} size={iconSize} weight="regular" className="text-white" />,
      );

  const html = `
    <div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:${bg};
      border:2px solid #fff;
      box-shadow:0 1px 2px rgba(0,0,0,0.15),0 2px 4px rgba(0,0,0,0.10);
      display:flex;align-items:center;justify-content:center;
      color:${fg};cursor:pointer;transition:transform 120ms ease;
    "
    onmouseover="this.style.transform='scale(1.08)'"
    onmouseout="this.style.transform='scale(1)'"
    >${innerMarkup}</div>
  `;
  bubbleCache.set(cacheKey, html);
  return html;
}

function renderClusterBubble(count: number): string {
  const size = count < 10 ? 30 : count < 100 ? 36 : 44;
  const fontSize = count < 10 ? 12 : count < 100 ? 12 : 11;
  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:rgba(70,70,75,0.92);
      border:2px solid #fff;
      color:#fff;
      box-shadow:0 1px 2px rgba(0,0,0,0.15),0 2px 6px rgba(0,0,0,0.15);
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;
      font-size:${fontSize}px;font-weight:600;
      cursor:pointer;transition:transform 120ms ease;
    "
    onmouseover="this.style.transform='scale(1.08)'"
    onmouseout="this.style.transform='scale(1)'"
    >${count}</div>
  `;
}

export interface MapHandle {
  /** Pan to lat/lng. Optional `zoom` flies to that zoom level too —
   *  used by the geocoder's address picks to drop the user close
   *  enough to see café markers. Without it, zoom stays the same. */
  panTo: (lat: number, lng: number, zoom?: number) => void;
  getCenter: () => { lat: number; lng: number } | null;
  /** Returns [west, south, east, north] in lng/lat for the current viewport. */
  getBoundsBbox: () => [number, number, number, number] | null;
  setUserLocation: (lat: number, lng: number) => void;
}

function renderUserLocationMarker(): string {
  return `
    <div style="
      width:18px;height:18px;border-radius:9999px;
      background:#0A84FF;
      border:3px solid #fff;
      box-shadow:0 0 0 4px rgba(10,132,255,0.18),0 1px 4px rgba(0,0,0,0.25);
      pointer-events:none;
    "></div>
  `;
}

export const MapContainer = forwardRef<
  MapHandle,
  {
    places: DemoPlace[];
    center: { lat: number; lng: number };
    /** First-mount zoom. Defaults to a city-level 13. Pass a smaller
     *  value (e.g. 2) for a world fallback when no geolocation is
     *  available. After mount, use `panTo` for movement. */
    initialZoom?: number;
    onSelectPlace: (place: DemoPlace) => void;
    /** Fires (debounced upstream) on every moveend with the new viewport. */
    onViewportChange?: (bbox: [number, number, number, number]) => void;
  }
>(function MapContainer({ places, center, initialZoom = 13, onSelectPlace, onViewportChange }, ref) {
  const initialCenterRef = useRef(center);
  const initialZoomRef = useRef(initialZoom);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectPlace);
  const onViewportRef = useRef(onViewportChange);

  useEffect(() => {
    onSelectRef.current = onSelectPlace;
  }, [onSelectPlace]);

  useEffect(() => {
    onViewportRef.current = onViewportChange;
  }, [onViewportChange]);

  const index = useMemo(() => {
    const features: PointFeature<PlaceProps>[] = places.map((p) => ({
      type: 'Feature',
      properties: { placeId: p.id },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    }));
    const cluster = new Supercluster<PlaceProps, AnyProps>({
      radius: 48,
      maxZoom: 17,
      minPoints: 2,
    });
    cluster.load(features);
    return cluster;
  }, [places]);

  const placesById = useMemo(() => {
    const m = new Map<string, DemoPlace>();
    for (const p of places) m.set(p.id, p);
    return m;
  }, [places]);

  useImperativeHandle(
    ref,
    () => ({
      panTo: (lat: number, lng: number, zoom?: number) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({
          center: [lng, lat],
          ...(zoom !== undefined ? { zoom } : {}),
          duration: 600,
          essential: true,
        });
      },
      getCenter: () => {
        const map = mapRef.current;
        if (!map) return null;
        const c = map.getCenter();
        return { lat: c.lat, lng: c.lng };
      },
      getBoundsBbox: () => {
        const map = mapRef.current;
        if (!map) return null;
        const b = map.getBounds();
        return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      },
      setUserLocation: (lat: number, lng: number) => {
        const map = mapRef.current;
        if (!map) return;
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([lng, lat]);
          return;
        }
        const wrap = document.createElement('div');
        wrap.innerHTML = renderUserLocationMarker();
        userMarkerRef.current = new maplibregl.Marker({ element: wrap, anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(map);
      },
    }),
    [],
  );

  // Init map once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    try {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: TILE_STYLE_URL,
        center: [initialCenterRef.current.lng, initialCenterRef.current.lat],
        zoom: initialZoomRef.current,
        attributionControl: false,
      });
      mapRef.current = map;

      const emitViewport = () => {
        const cb = onViewportRef.current;
        if (!cb) return;
        const b = map.getBounds();
        cb([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      map.on('load', () => {
        if (!cancelled) {
          tintParksGreen(map);
          addLandmarkLayers(map);
          setReady(true);
          emitViewport();
        }
      });
      // If the style is swapped at runtime (e.g. via the env override),
      // re-apply the park tint + landmark layers on the new style.
      // style.load fires after setStyle() — the initial style.load is
      // covered by the 'load' above.
      map.on('style.load', () => {
        if (!cancelled) {
          tintParksGreen(map);
          addLandmarkLayers(map);
        }
      });
      map.on('moveend', emitViewport);
      map.on('error', (e) => {
        if (!cancelled) {
          const msg = e?.error?.message ?? 'Failed to load map tiles';
          setError(msg);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to init map');
    }

    return () => {
      cancelled = true;
      for (const marker of markersRef.current) {
        try {
          marker.remove();
        } catch {
          // ignore
        }
      }
      markersRef.current = [];
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {
          // ignore
        }
      }
      mapRef.current = null;
    };
  }, []);

  // Recompute cluster markers whenever places, viewport, or ready change
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;

    const rebuild = () => {
      const zoom = Math.max(0, Math.min(22, Math.floor(map.getZoom())));
      const pinSize = zoom >= 18 ? 22 : zoom >= 16 ? 24 : zoom >= 14 ? 22 : 20;
      const bounds = map.getBounds();
      const bbox: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const clusters = index.getClusters(bbox, zoom);

      // At max zoom, supercluster stops clustering — but places that share
      // identical (or near-identical) coordinates still stack on the same
      // pixel. Spread colocated singletons in a small ring so each is
      // individually clickable. See #17.
      const placeFeatures = clusters.filter(
        (f): f is PointFeature<PlaceProps> => !('cluster' in f.properties && f.properties.cluster),
      );
      const displaced = spreadColocated(placeFeatures, zoom);

      // Remove previous markers
      for (const marker of markersRef.current) {
        try {
          marker.remove();
        } catch {
          // ignore
        }
      }
      markersRef.current = [];

      const next: maplibregl.Marker[] = [];
      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;

        if ('cluster' in feature.properties && feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature<AnyProps>;
          const count = clusterFeature.properties.point_count ?? 0;
          const clusterId = clusterFeature.properties.cluster_id as number;
          // Outer wrap is what MapLibre positions via transform — must NOT have
          // any inline transform of its own, otherwise hover/click resets the
          // pin to (0,0). Inner styled bubble owns the hover scale.
          const wrap = document.createElement('div');
          wrap.innerHTML = renderClusterBubble(count);
          const inner = wrap.firstElementChild as HTMLElement;
          inner.addEventListener('click', (e) => {
            e.stopPropagation();
            const leaves = index.getLeaves(clusterId, Infinity, 0) as PointFeature<PlaceProps>[];
            if (leaves.length === 0) return;
            let minLat = Infinity;
            let maxLat = -Infinity;
            let minLng = Infinity;
            let maxLng = -Infinity;
            for (const leaf of leaves) {
              const [lLng, lLat] = leaf.geometry.coordinates;
              if (lLat < minLat) minLat = lLat;
              if (lLat > maxLat) maxLat = lLat;
              if (lLng < minLng) minLng = lLng;
              if (lLng > maxLng) maxLng = lLng;
            }
            try {
              map.fitBounds(
                [
                  [minLng, minLat],
                  [maxLng, maxLat],
                ],
                { padding: 80, duration: 600, maxZoom: 18 },
              );
            } catch {
              map.flyTo({ center: [lng, lat], zoom: zoom + 2, duration: 600 });
            }
          });
          const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
            .setLngLat([lng, lat])
            .addTo(map);
          next.push(marker);
        } else {
          const placeId = (feature.properties as PlaceProps).placeId;
          const place = placesById.get(placeId);
          if (!place) continue;
          const wrap = document.createElement('div');
          wrap.innerHTML = renderPlaceBubble(place, pinSize);
          const inner = wrap.firstElementChild as HTMLElement;
          inner.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectRef.current(place);
          });
          const coords = displaced.get(placeId) ?? [lng, lat];
          const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
            .setLngLat(coords)
            .addTo(map);
          next.push(marker);
        }
      }
      markersRef.current = next;
    };

    rebuild();
    map.on('moveend', rebuild);
    return () => {
      try {
        map.off('moveend', rebuild);
      } catch {
        // ignore
      }
    };
  }, [ready, index, placesById]);

  return (
    <div className="relative h-full w-full bg-map-bg">
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      {!ready && !error && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-(--map-bg)">
            <div className="absolute inset-0 shimmer" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-(--text-secondary) text-[13px]">
            Loading map…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
          <div>
            <div className="text-base font-semibold mb-1">Map unavailable</div>
            <div className="text-sys-gray text-sm max-w-sm mx-auto">
              {error}. Tile provider may be temporarily down — refresh in a moment.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
