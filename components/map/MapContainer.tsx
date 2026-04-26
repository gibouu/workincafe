'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Supercluster from 'supercluster';
import type { AnyProps, PointFeature, ClusterFeature } from 'supercluster';
import {
  loadMapKit,
  type MapKitMap,
  type MapKitAnnotation,
  type MapKitGlobal,
  type MapKitRegion,
} from '@/lib/mapkit/client';
import { Icon } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import { brandLogoFor } from '@/lib/brand-logos';
import { type DemoPlace } from '@/lib/demo/paris-places';

const INCLUDED_POI_KEYS = ['Cafe', 'Bakery', 'Library', 'Hotel', 'Restaurant', 'FoodMarket'] as const;

type PlaceProps = { placeId: string };

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function renderPlaceBubble(place: DemoPlace, size = 40): string {
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
  const size = count < 10 ? 44 : count < 100 ? 52 : 60;
  return `
    <div style="
      width:${size}px;height:${size}px;border-radius:9999px;
      background:rgba(70,70,75,0.92);
      border:2px solid #fff;
      color:#fff;
      box-shadow:0 1px 2px rgba(0,0,0,0.15),0 2px 6px rgba(0,0,0,0.15);
      display:flex;align-items:center;justify-content:center;
      font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;
      font-size:${count < 100 ? 15 : 13}px;font-weight:600;
      cursor:pointer;transition:transform 120ms ease;
    "
    onmouseover="this.style.transform='scale(1.06)'"
    onmouseout="this.style.transform='scale(1)'"
    >${count}</div>
  `;
}

function zoomFromRegion(region: MapKitRegion): number {
  // Approximate web-mercator zoom from MapKit longitude delta.
  const span = Math.max(region.span.longitudeDelta, 0.0001);
  return Math.log2(360 / span);
}

export interface MapHandle {
  panTo: (lat: number, lng: number) => void;
  getCenter: () => { lat: number; lng: number } | null;
}

export const MapContainer = forwardRef<
  MapHandle,
  {
    places: DemoPlace[];
    center: { lat: number; lng: number };
    onSelectPlace: (place: DemoPlace) => void;
  }
>(function MapContainer({ places, center, onSelectPlace }, ref) {
  const initialCenterRef = useRef(center);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapKitMap | null>(null);
  const mapkitRef = useRef<MapKitGlobal | null>(null);
  const annotationsRef = useRef<MapKitAnnotation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelectPlace);

  useEffect(() => {
    onSelectRef.current = onSelectPlace;
  }, [onSelectPlace]);

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
        const mapkit = mapkitRef.current;
        const map = mapRef.current;
        if (!mapkit || !map) return;
        const coord = new mapkit.Coordinate(lat, lng);
        if (typeof map.setCenterAnimated === 'function') {
          map.setCenterAnimated(coord, true);
        } else {
          map.center = coord;
        }
      },
      getCenter: () => {
        const map = mapRef.current;
        if (!map) return null;
        return { lat: map.center.latitude, lng: map.center.longitude };
      },
    }),
    [],
  );

  // Init map once on mount
  useEffect(() => {
    let cancelled = false;

    loadMapKit()
      .then((mapkit) => {
        if (cancelled || !containerRef.current) return;
        mapkitRef.current = mapkit;
        const { lat: initLat, lng: initLng } = initialCenterRef.current;
        const map = new mapkit.Map(containerRef.current, {
          center: new mapkit.Coordinate(initLat, initLng),
          cameraZoomRange: new mapkit.CameraZoomRange(1, 20000),
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          showsZoomControl: false,
          colorScheme: mapkit.Map.ColorSchemes.Light,
          mapType: mapkit.Map.MapTypes.Standard,
        });
        mapRef.current = map;

        const includedCategories = INCLUDED_POI_KEYS
          .map((key) => mapkit.PointOfInterestCategory[key])
          .filter((v): v is unknown => v !== undefined);
        try {
          map.pointsOfInterestFilter = new mapkit.PointOfInterestFilter({
            including: includedCategories,
          });
        } catch {
          // fall back to all POIs
        }

        setReady(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load map');
      });

    return () => {
      cancelled = true;
      const map = mapRef.current;
      if (map) {
        try {
          if (annotationsRef.current.length) map.removeAnnotations(annotationsRef.current);
        } catch {
          // ignore
        }
        if (typeof map.destroy === 'function') map.destroy();
      }
      mapRef.current = null;
      mapkitRef.current = null;
      annotationsRef.current = [];
    };
  }, []);

  // Recompute cluster annotations whenever places, region, or ready change
  useEffect(() => {
    if (!ready) return;
    const mapkit = mapkitRef.current;
    const map = mapRef.current;
    if (!mapkit || !map) return;

    const rebuild = () => {
      const region = map.region;
      const zoom = Math.max(0, Math.min(22, Math.floor(zoomFromRegion(region))));
      // Shrink pins when the user has zoomed far in; otherwise dense areas overlap.
      const pinSize = zoom >= 18 ? 28 : zoom >= 16 ? 32 : 40;
      const halfLat = region.span.latitudeDelta / 2;
      const halfLng = region.span.longitudeDelta / 2;
      const bbox: [number, number, number, number] = [
        region.center.longitude - halfLng,
        region.center.latitude - halfLat,
        region.center.longitude + halfLng,
        region.center.latitude + halfLat,
      ];
      const clusters = index.getClusters(bbox, zoom);

      // Remove previous
      if (annotationsRef.current.length) {
        try {
          map.removeAnnotations(annotationsRef.current);
        } catch {
          // ignore
        }
        annotationsRef.current = [];
      }

      const next: MapKitAnnotation[] = [];
      for (const feature of clusters) {
        const [lng, lat] = feature.geometry.coordinates;
        const coord = new mapkit.Coordinate(lat, lng);

        if ('cluster' in feature.properties && feature.properties.cluster) {
          const clusterFeature = feature as ClusterFeature<AnyProps>;
          const count = clusterFeature.properties.point_count ?? 0;
          const clusterId = clusterFeature.properties.cluster_id as number;
          const annotation = new mapkit.Annotation(
            coord,
            () => {
              const wrap = document.createElement('div');
              wrap.innerHTML = renderClusterBubble(count);
              return wrap.firstElementChild as HTMLElement;
            },
            { data: { clusterId, count } },
          );
          annotation.addEventListener('select', () => {
            // Fit the cluster's bounding box so the user actually sees the places
            // it represents. If the points are nearly co-located, fall back to a
            // sensible minimum span so we don't max-zoom into nothing.
            const leaves = index.getLeaves(clusterId, Infinity, 0) as PointFeature<PlaceProps>[];
            if (!mapkitRef.current || !map.setRegionAnimated) {
              map.center = new mapkit.Coordinate(lat, lng);
              return;
            }
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

            // Add ~30% padding around the bbox so pins aren't at the edge.
            const latSpan = Math.max(maxLat - minLat, 0.0008) * 1.3;
            const lngSpan = Math.max(maxLng - minLng, 0.0008) * 1.3;
            const centerLat = (minLat + maxLat) / 2;
            const centerLng = (minLng + maxLng) / 2;

            try {
              map.setRegionAnimated(
                {
                  center: new mapkitRef.current.Coordinate(centerLat, centerLng),
                  span: { latitudeDelta: latSpan, longitudeDelta: lngSpan },
                },
                true,
              );
            } catch {
              // ignore
            }
          });
          next.push(annotation);
        } else {
          const placeId = (feature.properties as PlaceProps).placeId;
          const place = placesById.get(placeId);
          if (!place) continue;
          const annotation = new mapkit.Annotation(
            coord,
            () => {
              const wrap = document.createElement('div');
              wrap.innerHTML = renderPlaceBubble(place, pinSize);
              return wrap.firstElementChild as HTMLElement;
            },
            {
              title: place.name,
              subtitle: place.neighborhood,
              data: { placeId: place.id },
            },
          );
          annotation.addEventListener('select', () => {
            onSelectRef.current(place);
          });
          next.push(annotation);
        }
      }
      if (next.length) map.addAnnotations(next);
      annotationsRef.current = next;
    };

    rebuild();
    map.addEventListener('region-change-end', rebuild);
    return () => {
      if (map.removeEventListener) {
        try {
          map.removeEventListener('region-change-end', rebuild);
        } catch {
          // ignore
        }
      }
    };
  }, [ready, index, placesById]);

  return (
    <div className="relative h-full w-full bg-map-bg">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && !error && (
        <div className="absolute inset-0 overflow-hidden">
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
              {error}. Add Apple MapKit keys to <code className="px-1 bg-sys-gray-6 rounded">.env.local</code> to enable the map.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
