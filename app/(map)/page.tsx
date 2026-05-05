'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { consumePending } from '@/lib/auth/pending-submit';
import { useToasts } from '@/lib/store/toasts';
import { MapContainer, type MapHandle } from '@/components/map/MapContainer';
import { PlaceCard } from '@/components/card/PlaceCard';
import { FloatingPlaceCard } from '@/components/card/FloatingPlaceCard';
import { FloatingProfileCard } from '@/components/card/FloatingProfileCard';
import { FloatingFriendsCard } from '@/components/card/FloatingFriendsCard';
import { ProfileSheet } from '@/components/card/ProfileSheet';
import { CoworkSheet } from '@/components/card/CoworkSheet';
import { TopRightControls } from '@/components/map/TopRightControls';
import { PlaceSidebar } from '@/components/layout/PlaceSidebar';
import { CitySwitcher } from '@/components/layout/CitySwitcher';
import { FilterSheet } from '@/components/filters/FilterSheet';
import { AttributionPill } from '@/components/map/AttributionPill';
import { LiveUpdateSheet } from '@/components/review/LiveUpdateSheet';
import { WelcomeOverlay } from '@/components/onboarding/WelcomeOverlay';
import { Icon } from '@/components/icons/Icon';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLiveUpdatePrompt } from '@/hooks/useLiveUpdatePrompt';
import { useFilters } from '@/lib/store/filters';
import { useLayout } from '@/lib/store/layout';
import { useCity, CITIES } from '@/lib/store/city';
import type { DemoPlace } from '@/lib/demo/paris-places';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Placeholder defaults for fields the slim /api/places payload doesn't
// ship. The real values land on click via /api/places/[id]. These are
// only used to satisfy the DemoPlace shape in MapContainer rendering.
const DEMO_PLACE_DEFAULTS = {
  address: '',
  neighborhood: '',
  rating: 0,
  review_count: 0,
  avg_spend_eur: 0,
  wifi: 'unknown',
  noise: 'unknown',
  outlets: 'unknown',
  seats: 'unknown',
  lighting: 'unknown',
  tabletime_hours: 0,
  right_now_noise: 'No recent live updates',
  right_now_seating: 'No recent live updates',
} as const;

export default function MapPage() {
  const [selectedPlace, setSelectedPlace] = useState<DemoPlace | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const router = useRouter();
  const mapRef = useRef<MapHandle>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const showToast = useToasts((s) => s.show);
  const setCardOpen = useLayout((s) => s.setCardOpen);
  const panel = useLayout((s) => s.panel);
  const setPanel = useLayout((s) => s.setPanel);
  const [showWelcome, setShowWelcome] = useState(false);

  // selectedPlace and panel are mutated atomically inside event handlers
  // (handleSelectPlace, the various onClose callbacks). No sync effects —
  // they introduced a race that could clear selectedPlace before
  // setPanel('place') committed, leaving the place card empty.
  useEffect(() => () => setCardOpen(false), [setCardOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem('wic:onboarded');
      if (!seen) setShowWelcome(true);
    } catch {
      // ignore
    }
  }, []);

  // Replay any pending submission saved before login.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const submit = new URLSearchParams(window.location.search).get('submit');
    if (!submit) return;

    const stripParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('submit');
      window.history.replaceState(null, '', url.toString());
    };

    if (submit === 'checkin') {
      const env = consumePending<{ place_id: string; lat: number; lng: number }>('checkin');
      stripParam();
      if (!env) return;
      void fetch('/api/checkins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(env.payload),
      })
        .then((r) => {
          if (r.ok || r.status === 503 || r.status === 404) {
            showToast('Live review posted');
          } else {
            showToast('Could not post live review', { tone: 'error' });
          }
        })
        .catch(() => showToast('Could not post live review', { tone: 'error' }));
      return;
    }

    if (submit === 'live-update') {
      const env = consumePending<Record<string, unknown>>('live-update');
      stripParam();
      if (!env) return;
      void fetch('/api/live-updates', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(env.payload),
      })
        .then((r) => {
          if (r.ok || r.status === 503 || r.status === 404) {
            showToast('Update shared');
          } else {
            showToast('Could not share update', { tone: 'error' });
          }
        })
        .catch(() => showToast('Could not share update', { tone: 'error' }));
    }
  }, [showToast]);

  const city = useCity((s) => s.city);
  const cityMeta = CITIES[city];
  const filters = useFilters();
  const activeFilterCount = useFilters((s) => s.activeCount());

  // Load real places from Supabase. The full payload (capped at 2500/city,
  // sorted by name) feeds the sidebar and the card. The slim payload below
  // — id/name/category/lat/lng/brand only, bbox-bounded — drives the map
  // markers so we never ship the entire city to the browser at once.
  const [livePlaces, setLivePlaces] = useState<DemoPlace[] | null>(null);
  useEffect(() => {
    let aborted = false;
    setLivePlaces(null);
    fetch(`/api/places?city=${encodeURIComponent(city)}`)
      .then((r) => (r.ok ? r.json() : { places: [] }))
      .then((data: { places?: DemoPlace[] }) => {
        if (aborted) return;
        if (Array.isArray(data.places) && data.places.length > 0) setLivePlaces(data.places);
      })
      .catch(() => null);
    return () => {
      aborted = true;
    };
  }, [city]);

  // Slim viewport-bounded fetch for the map markers.
  interface SlimPlace {
    id: string;
    name: string;
    category: DemoPlace['category'];
    lat: number;
    lng: number;
    brand: string | null;
  }
  const [mapPlaces, setMapPlaces] = useState<SlimPlace[]>([]);
  const lastBboxRef = useRef<[number, number, number, number] | null>(null);
  useEffect(() => {
    setMapPlaces([]);
    lastBboxRef.current = null;
  }, [city]);

  const fetchMapBbox = useMemo(() => {
    let inflight: AbortController | null = null;
    return (bbox: [number, number, number, number]) => {
      if (inflight) inflight.abort();
      const ctrl = new AbortController();
      inflight = ctrl;
      const [w, s, e, n] = bbox;
      const url = `/api/places?city=${encodeURIComponent(city)}&bbox=${w},${s},${e},${n}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((data: { places?: SlimPlace[] }) => {
          if (Array.isArray(data.places)) setMapPlaces(data.places);
        })
        .catch(() => null);
    };
    // SlimPlace shape is local; only city changes invalidate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const onViewportChange = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (bbox: [number, number, number, number]) => {
      const last = lastBboxRef.current;
      // Skip if movement was tiny (under ~10% of viewport span).
      if (last) {
        const lastWidth = last[2] - last[0];
        const lastHeight = last[3] - last[1];
        const dx = Math.abs(bbox[0] - last[0]) + Math.abs(bbox[2] - last[2]);
        const dy = Math.abs(bbox[1] - last[1]) + Math.abs(bbox[3] - last[3]);
        if (dx < lastWidth * 0.1 && dy < lastHeight * 0.1) return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastBboxRef.current = bbox;
        fetchMapBbox(bbox);
      }, 250);
    };
  }, [fetchMapBbox]);

  const sourcePlaces: DemoPlace[] = livePlaces ?? cityMeta.places;

  const liveUpdate = useLiveUpdatePrompt(sourcePlaces);

  const visiblePlaces = useMemo(() => {
    return sourcePlaces.filter((p) => {
      if (filters.categories.size > 0 && !filters.categories.has(p.category)) return false;
      if (filters.outlets && p.outlets === 'none') return false;
      if (filters.noise !== 'any' && p.noise !== filters.noise) return false;
      if (filters.wifi !== 'any' && p.wifi !== filters.wifi) return false;
      if (filters.seats !== 'any' && p.seats !== filters.seats) return false;
      if (filters.minRating !== null && p.rating < filters.minRating) return false;
      return true;
    });
  }, [sourcePlaces, filters]);

  // The map renders the slim bbox-bounded set when we have one; otherwise
  // it falls back to the full city slice. We adapt slim rows to DemoPlace
  // with safe defaults so MapContainer's existing types still hold.
  const visibleMapPlaces: DemoPlace[] = useMemo(() => {
    const source: DemoPlace[] =
      mapPlaces.length > 0
        ? mapPlaces.map((p) => ({
            ...DEMO_PLACE_DEFAULTS,
            id: p.id,
            name: p.name,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            brand: p.brand,
          }))
        : visiblePlaces;
    if (filters.categories.size === 0) return source;
    return source.filter((p) => filters.categories.has(p.category));
  }, [mapPlaces, visiblePlaces, filters.categories]);

  // Pan to the active city's center whenever it changes.
  useEffect(() => {
    mapRef.current?.panTo(cityMeta.center.lat, cityMeta.center.lng);
    setSelectedPlace(null);
  }, [cityMeta.center.lat, cityMeta.center.lng]);

  // Ask the IP-geo endpoint immediately on mount and gently pan the map there
  // if the result is reasonably close to the active city. Runs alongside the
  // welcome overlay so the map already feels live underneath the tutorial.
  const ipPannedRef = useRef(false);
  useEffect(() => {
    if (ipPannedRef.current) return;
    ipPannedRef.current = true;

    void fetch('/api/geo')
      .then(async (r) => (r.status === 204 ? null : ((await r.json()) as { lat: number; lng: number })))
      .then((g) => {
        if (!g) return;
        const dKm = haversineKm(g.lat, g.lng, cityMeta.center.lat, cityMeta.center.lng);
        if (dKm < 80) mapRef.current?.panTo(g.lat, g.lng);
      })
      .catch(() => null);
  }, [cityMeta.center.lat, cityMeta.center.lng]);

  const handleSelectPlace = (place: DemoPlace) => {
    setSelectedPlace(place);
    setPanel('place');
    mapRef.current?.panTo(place.lat, place.lng);
    // Hydrate from /api/places/[id] when the slim payload was the source
    // (most fields will be defaults). Cheap no-op if the row was already
    // a fully-populated sidebar row.
    if (place.address === '' && place.review_count === 0) {
      void fetch(`/api/places/${encodeURIComponent(place.id)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { place?: DemoPlace } | null) => {
          if (data?.place) setSelectedPlace((curr) => (curr?.id === place.id ? data.place! : curr));
        })
        .catch(() => null);
    }
  };

  const handleOpenAddPlace = () => {
    const c = mapRef.current?.getCenter() ?? null;
    const qs = c ? `?lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}` : '';
    router.push(`/places/new${qs}`);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      showToast('Location not supported in this browser', { tone: 'error' });
      return;
    }
    setGeolocating(true);

    const applyFix = (pos: GeolocationPosition) => {
      mapRef.current?.setUserLocation(pos.coords.latitude, pos.coords.longitude);
      mapRef.current?.panTo(pos.coords.latitude, pos.coords.longitude);
      setGeolocating(false);
    };

    // Mobile gets a real GPS fix in 1–3s. Desktop Safari often hangs on
    // high-accuracy and silently times out — when it does, fall back to
    // WiFi/cell triangulation, which returns immediately.
    navigator.geolocation.getCurrentPosition(
      applyFix,
      (highErr) => {
        if (highErr.code === highErr.PERMISSION_DENIED) {
          setGeolocating(false);
          const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
          showToast(
            isIOS
              ? 'Location blocked. Tap “AA” in the URL bar → Website Settings → Allow Location, then retry.'
              : 'Location permission blocked. Allow it in browser settings, then refresh.',
            { tone: 'error' },
          );
          return;
        }
        navigator.geolocation.getCurrentPosition(
          applyFix,
          (lowErr) => {
            setGeolocating(false);
            const msg =
              lowErr.code === lowErr.POSITION_UNAVAILABLE
                ? 'Location unavailable. Check Privacy → Location Services.'
                : lowErr.code === lowErr.TIMEOUT
                  ? 'Location timed out. Try again.'
                  : 'Could not get your location.';
            showToast(msg, { tone: 'error' });
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  return (
    <div className="flex h-full w-full">
      <PlaceSidebar
        places={visiblePlaces}
        selectedId={selectedPlace?.id ?? null}
        onSelect={handleSelectPlace}
        onOpenFilter={() => setFilterOpen(true)}
        filterCount={activeFilterCount}
      />

      <main className="relative flex-1 overflow-hidden">
        <MapContainer
          ref={mapRef}
          center={cityMeta.center}
          places={visibleMapPlaces}
          onSelectPlace={handleSelectPlace}
          onViewportChange={onViewportChange}
        />
        <TopRightControls
          onFilter={() => setFilterOpen(true)}
          onGeolocate={handleGeolocate}
          geolocating={geolocating}
          filterCount={activeFilterCount}
          showFilter={!isDesktop}
        />

        {!isDesktop && (
          <div className="pointer-events-none absolute top-4 left-4 z-30">
            <div className="pointer-events-auto">
              <CitySwitcher compact />
            </div>
          </div>
        )}

        {isDesktop && panel === 'place' && selectedPlace && (
          <FloatingPlaceCard
            place={selectedPlace}
            onClose={() => {
              setSelectedPlace(null);
              setPanel(null);
            }}
          />
        )}
        {isDesktop && panel === 'profile' && (
          <FloatingProfileCard
            onClose={() => {
              setSelectedPlace(null);
              setPanel(null);
            }}
          />
        )}
        {isDesktop && panel === 'friends' && (
          <FloatingFriendsCard
            onClose={() => {
              setSelectedPlace(null);
              setPanel(null);
            }}
          />
        )}

        <button
          type="button"
          onClick={handleOpenAddPlace}
          aria-label="Add a place"
          title="Add a place"
          className="pointer-events-auto absolute bottom-[96px] left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-float backdrop-blur-ios hover:bg-white"
        >
          <Icon name="Plus" size={16} weight="bold" />
        </button>

        <AttributionPill />
      </main>

      {!isDesktop && (
        <>
          <PlaceCard
            place={selectedPlace}
            open={selectedPlace !== null}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedPlace(null);
                setPanel(null);
              }
            }}
          />
          <ProfileSheet
            open={panel === 'profile'}
            onOpenChange={(open) => {
              if (!open) setPanel(null);
            }}
          />
          <CoworkSheet
            open={panel === 'friends'}
            onOpenChange={(open) => {
              if (!open) setPanel(null);
            }}
          />
        </>
      )}

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} />

      <LiveUpdateSheet
        place={liveUpdate.place}
        open={liveUpdate.place !== null}
        onOpenChange={(next) => {
          if (!next && liveUpdate.place) liveUpdate.dismiss(liveUpdate.place.id);
        }}
      />

      {showWelcome && (
        <WelcomeOverlay
          onDismiss={() => {
            setShowWelcome(false);
            // Trigger the precise-GPS prompt right after the tutorial finishes
            // so the user sees the browser's "Allow location?" prompt while the
            // map is already onscreen. Synchronous call inside the user-gesture
            // chain keeps Safari happy.
            handleGeolocate();
          }}
        />
      )}
    </div>
  );
}
