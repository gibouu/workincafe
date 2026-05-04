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

type PlaceProps = { placeId: string };

const TILE_STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/positron';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function renderPlaceBubble(place: DemoPlace, size = 24): string {
  const meta = categoryMeta(place.category);
  const brand = brandLogoFor(place.name);
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

  return `
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
  panTo: (lat: number, lng: number) => void;
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
    onSelectPlace: (place: DemoPlace) => void;
    /** Fires (debounced upstream) on every moveend with the new viewport. */
    onViewportChange?: (bbox: [number, number, number, number]) => void;
  }
>(function MapContainer({ places, center, onSelectPlace, onViewportChange }, ref) {
  const initialCenterRef = useRef(center);
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
      panTo: (lat: number, lng: number) => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo({ center: [lng, lat], duration: 600, essential: true });
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
        zoom: 13,
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
          setReady(true);
          emitViewport();
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
          const marker = new maplibregl.Marker({ element: wrap, anchor: 'center' })
            .setLngLat([lng, lat])
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
          <div className="absolute inset-0 bg-[var(--map-bg)]">
            <div className="absolute inset-0 shimmer" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-[var(--text-secondary)] text-[13px]">
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
