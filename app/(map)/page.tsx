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
import { GeolocateBlockedBanner } from '@/components/map/GeolocateBlockedBanner';
import {
  probeGeolocationPermission,
  watchGeolocationPermission,
  readCachedPosition,
  writeCachedPosition,
  geolocationErrorLabel,
  type GeolocatePermissionState,
} from '@/lib/geolocate';
import { PlaceSidebar } from '@/components/layout/PlaceSidebar';
import {
  MobileSearchButton,
  MobileSearchDrawer,
} from '@/components/layout/MobileSearchDrawer';
import { FilterSheet } from '@/components/filters/FilterSheet';
import { AttributionPill } from '@/components/map/AttributionPill';
import { LiveUpdateSheet } from '@/components/review/LiveUpdateSheet';
import { WelcomeOverlay } from '@/components/onboarding/WelcomeOverlay';
import { Icon } from '@/components/icons/Icon';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useLiveUpdatePrompt } from '@/hooks/useLiveUpdatePrompt';
import { useFilters } from '@/lib/store/filters';
import { useLayout } from '@/lib/store/layout';
import { WORLD_CENTER } from '@/lib/demo/cities';
import { isKnownChain } from '@/lib/brand-logos';
import type { DemoPlace } from '@/lib/demo/paris-places';
import type { SidebarAnchor } from '@/components/layout/PlaceSidebar';

// Placeholder defaults for fields the slim /api/places payload doesn't
// ship. The real values land on click via /api/places/[id].
const DEMO_PLACE_DEFAULTS = {
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

interface SlimPlace {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  category: DemoPlace['category'];
  lat: number;
  lng: number;
  brand: string | null;
  has_user_reviews?: boolean;
  is_validated?: boolean;
  rating?: number;
  membership_required?: string | null;
}

function slimToDemo(p: SlimPlace): DemoPlace {
  return {
    ...DEMO_PLACE_DEFAULTS,
    id: p.id,
    name: p.name,
    address: p.address,
    neighborhood: p.neighborhood,
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    brand: p.brand,
    has_user_reviews: p.has_user_reviews,
    is_validated: p.is_validated,
    rating: p.rating ?? 0,
    membership_required: p.membership_required ?? null,
  };
}

export default function MapPage() {
  const [selectedPlace, setSelectedPlace] = useState<DemoPlace | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const router = useRouter();
  const mapRef = useRef<MapHandle>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const showToast = useToasts((s) => s.show);
  const setCardOpen = useLayout((s) => s.setCardOpen);
  const panel = useLayout((s) => s.panel);
  const setPanel = useLayout((s) => s.setPanel);
  const [showWelcome, setShowWelcome] = useState(false);
  const [geolocatePermission, setGeolocatePermission] =
    useState<GeolocatePermissionState>('unknown');
  const [blockedBannerOpen, setBlockedBannerOpen] = useState(false);
  // Sidebar anchor for the location-search flow (#103). When set, the
  // sidebar list re-sorts by distance and the map pans to this point.
  const [sidebarAnchor, setSidebarAnchor] = useState<SidebarAnchor | null>(null);
  // Current map viewport — broadcast to the sidebar so search/geocode can
  // bias to whatever the user is looking at, and stored as the source of
  // truth for the add-place wizard.
  const [viewport, setViewport] = useState<{
    bbox: [number, number, number, number];
    center: { lat: number; lng: number };
  } | null>(null);
  const handleSetAnchor = (anchor: SidebarAnchor) => {
    setSidebarAnchor(anchor);
    mapRef.current?.panTo(anchor.lat, anchor.lng, anchor.zoom);
  };
  const handleClearAnchor = () => setSidebarAnchor(null);

  // Pick the first-render center: cached browser geolocation if we have it
  // (returning visitor), otherwise the world centroid at zoom 2. The user
  // sees their last neighborhood instantly without a flash of "everywhere".
  const initialCenterRef = useRef<{ lat: number; lng: number; zoom: number }>(
    (() => {
      if (typeof window === 'undefined') return { ...WORLD_CENTER };
      const cached = readCachedPosition();
      if (cached) return { lat: cached.lat, lng: cached.lng, zoom: 13 };
      return { ...WORLD_CENTER };
    })(),
  );

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
      return;
    }

    if (submit === 'validate') {
      const env = consumePending<{ placeId: string }>('validate');
      stripParam();
      if (!env) return;
      void fetch(`/api/places/${encodeURIComponent(env.placeId)}/validate`, {
        method: 'POST',
      })
        .then((r) => {
          if (r.ok || r.status === 503) {
            showToast('Place added to the map');
          } else {
            showToast('Could not validate the place', { tone: 'error' });
          }
        })
        .catch(() => showToast('Could not validate the place', { tone: 'error' }));
    }
  }, [showToast]);

  const filters = useFilters();
  const activeFilterCount = useFilters((s) => s.activeCount());

  // Slim viewport-bounded fetch — drives both the sidebar and the map
  // markers. There's no "city" filter anymore: as the user pans/zooms,
  // the bbox changes and we re-query.
  const [mapPlaces, setMapPlaces] = useState<SlimPlace[]>([]);
  const lastBboxRef = useRef<[number, number, number, number] | null>(null);

  // Skip the /api/places fetch when the viewport spans more than ~city-
  // metro size. At world / continent zoom there's no point shipping every
  // café in the database; the user can't see the markers anyway and the
  // payload + render is wasteful. ~2° latitude is roughly the diagonal of
  // a metro area at most latitudes (Paris fits in <0.1°, GTA in ~0.5°).
  const MAX_FETCH_SPAN_DEG = 2;

  const fetchMapBbox = useMemo(() => {
    let inflight: AbortController | null = null;
    return (bbox: [number, number, number, number]) => {
      const [w, s, e, n] = bbox;
      const span = Math.max(e - w, n - s);
      if (span > MAX_FETCH_SPAN_DEG) {
        // Zoom out beyond a metro — clear stale markers and skip the call.
        if (inflight) inflight.abort();
        setMapPlaces([]);
        return;
      }
      if (inflight) inflight.abort();
      const ctrl = new AbortController();
      inflight = ctrl;
      const url = `/api/places?bbox=${w},${s},${e},${n}`;
      fetch(url, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { places: [] }))
        .then((data: { places?: SlimPlace[] }) => {
          if (Array.isArray(data.places)) setMapPlaces(data.places);
        })
        .catch(() => null);
    };
  }, []);

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
      // Always update viewport state so search/geocode get a fresh bias
      // even when we skip the network request for tiny pans.
      setViewport({
        bbox,
        center: { lat: (bbox[1] + bbox[3]) / 2, lng: (bbox[0] + bbox[2]) / 2 },
      });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        lastBboxRef.current = bbox;
        fetchMapBbox(bbox);
      }, 250);
    };
  }, [fetchMapBbox]);

  const sourcePlaces: DemoPlace[] = useMemo(
    () => mapPlaces.map(slimToDemo),
    [mapPlaces],
  );

  const liveUpdate = useLiveUpdatePrompt(sourcePlaces);

  const visiblePlaces = useMemo(() => {
    return sourcePlaces.filter((p) => {
      if (filters.categories.size > 0 && !filters.categories.has(p.category)) {
        const isHighlyRatedRestaurant =
          p.category === 'restaurant' &&
          Boolean(p.has_user_reviews) &&
          (p.rating ?? 0) > 7;
        const isUserValidatedNonRestaurant =
          p.category !== 'restaurant' && Boolean(p.is_validated);
        const isIndependentBakeryWithCafe =
          p.category === 'bakery' &&
          filters.categories.has('cafe') &&
          !isKnownChain(p.brand ?? null);
        if (
          !isHighlyRatedRestaurant &&
          !isUserValidatedNonRestaurant &&
          !isIndependentBakeryWithCafe
        ) {
          return false;
        }
      }
      if (filters.outlets && p.outlets === 'none') return false;
      if (filters.noise !== 'any' && p.noise !== filters.noise) return false;
      if (filters.wifi !== 'any' && p.wifi !== filters.wifi) return false;
      if (filters.seats !== 'any' && p.seats !== filters.seats) return false;
      if (filters.minRating !== null && p.rating < filters.minRating) return false;
      // Membership filter (#127): 'free-only' drops paywall'd; 'members-only'
      // keeps only paywall'd. 'any' (default) passes everything.
      const hasMembership = Boolean(p.membership_required);
      if (filters.membership === 'free-only' && hasMembership) return false;
      if (filters.membership === 'members-only' && !hasMembership) return false;
      return true;
    });
  }, [sourcePlaces, filters]);

  // Probe the Permissions API once on mount. Used by `handleGeolocate` to
  // short-circuit known-denied state into the recovery banner, and by the
  // geolocate button to render its red-dot indicator. See #71.
  useEffect(() => {
    let unsub = () => {};
    void probeGeolocationPermission().then((state) => {
      setGeolocatePermission(state);
      console.info('[geolocate] initial permission state=%s', state);
    });
    void watchGeolocationPermission((state) => {
      setGeolocatePermission(state);
      console.info('[geolocate] permission changed to=%s', state);
    }).then((u) => {
      unsub = u;
    });
    return () => unsub();
  }, []);

  // PermissionStatus.onchange is unreliable on iOS Safari. Re-probe on
  // visibilitychange so the red-dot indicator clears without a click. #89.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void probeGeolocationPermission().then((state) => {
        setGeolocatePermission((curr) => {
          if (curr === state) return curr;
          console.info('[geolocate] visibility re-probe %s → %s', curr, state);
          return state;
        });
      });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Last-known position pan: returning visitor lands on their actual
  // location. We already used the cached position for `initialCenterRef`,
  // but also drop the user-location dot once the map is mounted.
  const cachedPanRef = useRef(false);
  useEffect(() => {
    if (cachedPanRef.current) return;
    const cached = readCachedPosition();
    if (cached) {
      cachedPanRef.current = true;
      const t = setTimeout(() => {
        mapRef.current?.setUserLocation(cached.lat, cached.lng);
      }, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  // If permission is already 'granted' on mount, fire `getCurrentPosition`
  // silently — no prompt, no UI change, just an accurate pan as soon as
  // the GPS fix lands. Re-runs once permission flips to granted.
  const silentPanFiredRef = useRef(false);
  useEffect(() => {
    if (silentPanFiredRef.current) return;
    if (geolocatePermission !== 'granted') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    silentPanFiredRef.current = true;
    console.info('[geolocate] permission=granted, firing silent getCurrentPosition');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        console.info(
          '[geolocate] silent fix lat=%s lng=%s accuracy=%sm',
          latitude.toFixed(5),
          longitude.toFixed(5),
          pos.coords.accuracy,
        );
        writeCachedPosition(latitude, longitude);
        mapRef.current?.setUserLocation(latitude, longitude);
        // Browser geolocation is precise — zoom in to ~500m radius so
        // the user sees their immediate surroundings, not the whole metro.
        mapRef.current?.panTo(latitude, longitude, 15);
      },
      (err) => {
        console.warn(
          '[geolocate] silent err=%s code=%d',
          geolocationErrorLabel(err.code),
          err.code,
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  }, [geolocatePermission]);

  // First-load IP-geo pan: only fires when no cached browser position
  // hydrated us already and the user hasn't granted geolocation. Lets a
  // brand-new visitor still land on roughly their region instead of the
  // world-zoom fallback. The IP coords aren't precise (carrier-NAT'd
  // mobile users land on Boulogne-Billancourt for the whole French
  // coast), so we zoom to city level (13) — close enough to see cafés
  // without committing to a precise spot.
  const ipPannedRef = useRef(false);
  useEffect(() => {
    if (ipPannedRef.current) return;
    if (cachedPanRef.current) return;
    ipPannedRef.current = true;
    void fetch('/api/geo')
      .then(async (r) =>
        r.status === 204
          ? null
          : ((await r.json()) as { lat: number; lng: number }),
      )
      .then((g) => {
        if (!g) return;
        if (cachedPanRef.current) return;
        mapRef.current?.panTo(g.lat, g.lng, 13);
      })
      .catch(() => null);
  }, []);

  const handleSelectPlace = (place: DemoPlace) => {
    setSelectedPlace(place);
    setPanel('place');
    mapRef.current?.panTo(place.lat, place.lng);
    // Hydrate from /api/places/[id] when the slim payload was the source.
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
    const b = mapRef.current?.getBoundsBbox() ?? null;
    const parts: string[] = [];
    if (c) parts.push(`lat=${c.lat.toFixed(6)}`, `lng=${c.lng.toFixed(6)}`);
    if (b) parts.push(`bbox=${b.map((n) => n.toFixed(6)).join(',')}`);
    const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
    router.push(`/places/new${qs}`);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      showToast('Location not supported in this browser', { tone: 'error' });
      return;
    }
    setGeolocating(true);

    const applyFix = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      console.info(
        '[geolocate] fix lat=%s lng=%s accuracy=%sm',
        latitude.toFixed(5),
        longitude.toFixed(5),
        pos.coords.accuracy,
      );
      writeCachedPosition(latitude, longitude);
      mapRef.current?.setUserLocation(latitude, longitude);
      // Same ~500m-radius zoom as the silent-pan branch on mount.
      mapRef.current?.panTo(latitude, longitude, 15);
      setGeolocating(false);
    };

    navigator.geolocation.getCurrentPosition(
      applyFix,
      (highErr) => {
        console.warn(
          '[geolocate] high-accuracy err=%s code=%d msg=%s',
          geolocationErrorLabel(highErr.code),
          highErr.code,
          highErr.message,
        );
        if (highErr.code === highErr.PERMISSION_DENIED) {
          setGeolocating(false);
          setGeolocatePermission('denied');
          setBlockedBannerOpen(true);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          applyFix,
          (lowErr) => {
            setGeolocating(false);
            console.warn(
              '[geolocate] low-accuracy err=%s code=%d msg=%s',
              geolocationErrorLabel(lowErr.code),
              lowErr.code,
              lowErr.message,
            );
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
        anchor={sidebarAnchor}
        onSetAnchor={handleSetAnchor}
        onClearAnchor={handleClearAnchor}
        viewport={viewport}
      />

      <main className="relative flex-1 overflow-hidden">
        <MapContainer
          ref={mapRef}
          center={initialCenterRef.current}
          initialZoom={initialCenterRef.current.zoom}
          places={visiblePlaces}
          onSelectPlace={handleSelectPlace}
          onViewportChange={onViewportChange}
        />
        <TopRightControls
          onFilter={() => setFilterOpen(true)}
          onGeolocate={handleGeolocate}
          geolocating={geolocating}
          geolocateBlocked={geolocatePermission === 'denied'}
          filterCount={activeFilterCount}
          showFilter={!isDesktop}
          splitLayout={!isDesktop}
        />
        {!isDesktop && (
          <MobileSearchButton onClick={() => setMobileSearchOpen(true)} />
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

      {!isDesktop && (
        <MobileSearchDrawer
          open={mobileSearchOpen}
          onOpenChange={setMobileSearchOpen}
          places={visiblePlaces}
          selectedId={selectedPlace?.id ?? null}
          onSelect={handleSelectPlace}
          onOpenFilter={() => setFilterOpen(true)}
          filterCount={activeFilterCount}
          anchor={sidebarAnchor}
          onSetAnchor={handleSetAnchor}
          onClearAnchor={handleClearAnchor}
          viewport={viewport}
        />
      )}

      <LiveUpdateSheet
        place={liveUpdate.place}
        open={liveUpdate.place !== null}
        onOpenChange={(next) => {
          if (!next && liveUpdate.place) liveUpdate.dismiss(liveUpdate.place.id);
        }}
      />

      {showWelcome && (
        <WelcomeOverlay
          onDismiss={() => setShowWelcome(false)}
          onEnableLocation={handleGeolocate}
        />
      )}

      <GeolocateBlockedBanner
        open={blockedBannerOpen}
        onClose={() => setBlockedBannerOpen(false)}
      />
    </div>
  );
}
