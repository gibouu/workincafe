// Minimal typings for Apple MapKit JS. The full surface is large;
// we expose what the Phase 0/2 code paths need and leave the rest as `unknown`.

type AuthorizationCallback = (done: (token: string) => void) => void;

export interface MapKitCoordinate {
  latitude: number;
  longitude: number;
}

export interface MapKitAnnotation {
  coordinate: MapKitCoordinate;
  data?: Record<string, unknown>;
  addEventListener(event: 'select' | 'deselect', handler: (ev: unknown) => void): void;
  removeEventListener?(event: 'select' | 'deselect', handler: (ev: unknown) => void): void;
}

export interface MapKitRegion {
  center: MapKitCoordinate;
  span: { latitudeDelta: number; longitudeDelta: number };
}

type RegionChangeEvent = 'region-change-start' | 'region-change-end';

export interface MapKitMap {
  center: MapKitCoordinate;
  region: MapKitRegion;
  pointsOfInterestFilter?: unknown;
  showsPointsOfInterest?: boolean;
  addAnnotation(annotation: MapKitAnnotation): void;
  addAnnotations(annotations: MapKitAnnotation[]): void;
  removeAnnotation(annotation: MapKitAnnotation): void;
  removeAnnotations(annotations: MapKitAnnotation[]): void;
  setCenterAnimated?(coord: MapKitCoordinate, animated?: boolean): void;
  setRegionAnimated?(region: unknown, animated?: boolean): void;
  addEventListener(event: RegionChangeEvent, handler: (ev: unknown) => void): void;
  removeEventListener?(event: RegionChangeEvent, handler: (ev: unknown) => void): void;
  destroy?(): void;
}

type AnnotationFactory = (coordinate: MapKitCoordinate, options: Record<string, unknown>) => HTMLElement;

interface MapConstructor {
  new (element: HTMLElement, options?: Record<string, unknown>): MapKitMap;
  ColorSchemes: { Light: unknown; Dark: unknown };
  MapTypes: { Standard: unknown; MutedStandard: unknown; Hybrid: unknown; Satellite: unknown };
}

export interface MapKitGlobal {
  init(options: {
    authorizationCallback: AuthorizationCallback;
    language?: string;
  }): void;
  Map: MapConstructor;
  Coordinate: new (latitude: number, longitude: number) => MapKitCoordinate;
  CameraZoomRange: new (min: number, max: number) => unknown;
  FeatureVisibility: { Hidden: unknown; Visible: unknown; Adaptive: unknown };
  Annotation: new (
    coord: MapKitCoordinate,
    factory: AnnotationFactory,
    options?: Record<string, unknown>,
  ) => MapKitAnnotation;
  PointOfInterestFilter: {
    new (options: { including?: unknown[]; excluding?: unknown[] }): unknown;
    including(categories: unknown[]): unknown;
    excluding(categories: unknown[]): unknown;
  };
  PointOfInterestCategory: {
    Cafe: unknown;
    Bakery: unknown;
    Library: unknown;
    Hotel: unknown;
    Restaurant: unknown;
    FoodMarket: unknown;
    [key: string]: unknown;
  };
  Search: new (options?: { region?: unknown }) => {
    search(query: string, callback: (err: unknown, data: { places: unknown[] }) => void): void;
  };
}

declare global {
  interface Window {
    mapkit?: MapKitGlobal;
  }
}

const CDN_URL = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

let loadPromise: Promise<MapKitGlobal> | null = null;

export function loadMapKit(): Promise<MapKitGlobal> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('MapKit can only load in the browser'));
  }
  if (window.mapkit) return Promise.resolve(window.mapkit);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<MapKitGlobal>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CDN_URL}"]`);
    const handleLoad = () => {
      const mapkit = window.mapkit;
      if (!mapkit) {
        reject(new Error('MapKit script loaded but window.mapkit is missing'));
        return;
      }
      mapkit.init({
        authorizationCallback: (done) => {
          fetch('/api/mapkit-token')
            .then(async (r) => {
              if (!r.ok) {
                const body = (await r.json().catch(() => ({}))) as { error?: string };
                throw new Error(body.error ?? `Token endpoint returned ${r.status}`);
              }
              return r.json() as Promise<{ token: string }>;
            })
            .then(({ token }) => done(token))
            .catch((err) => reject(err));
        },
      });
      resolve(mapkit);
    };

    if (existing) {
      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load MapKit script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CDN_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load MapKit script')), { once: true });
    document.head.appendChild(script);
  });

  return loadPromise;
}
