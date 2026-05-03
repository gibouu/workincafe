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
import { TopRightControls } from '@/components/map/TopRightControls';
import { PlaceSidebar } from '@/components/layout/PlaceSidebar';
import { CitySwitcher } from '@/components/layout/CitySwitcher';
import { FilterSheet } from '@/components/filters/FilterSheet';
import { AddPlaceSheet } from '@/components/map/AddPlaceSheet';
import { AttributionPill } from '@/components/map/AttributionPill';
import { LiveUpdateSheet } from '@/components/review/LiveUpdateSheet';
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

export default function MapPage() {
  const [selectedPlace, setSelectedPlace] = useState<DemoPlace | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [addPlaceCenter, setAddPlaceCenter] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const router = useRouter();
  const showToast = useToasts((s) => s.show);
  const setCardOpen = useLayout((s) => s.setCardOpen);
  const panel = useLayout((s) => s.panel);
  const setPanel = useLayout((s) => s.setPanel);
  const [onboardChecked, setOnboardChecked] = useState(false);

  // selectedPlace and panel are mutated atomically inside event handlers
  // (handleSelectPlace, the various onClose callbacks). No sync effects —
  // they introduced a race that could clear selectedPlace before
  // setPanel('place') committed, leaving the place card empty.
  useEffect(() => () => setCardOpen(false), [setCardOpen]);
  // Lazy listener: read cardOpen for plus-button positioning below.
  const cardOpen = useLayout((s) => s.cardOpen);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const seen = window.localStorage.getItem('wic:onboarded');
      if (!seen) {
        router.replace('/welcome');
        return;
      }
    } catch {
      // ignore
    }
    setOnboardChecked(true);
  }, [router]);

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

  const liveUpdate = useLiveUpdatePrompt(cityMeta.places);

  const visiblePlaces = useMemo(() => {
    return cityMeta.places.filter((p) => {
      if (filters.categories.size > 0 && !filters.categories.has(p.category)) return false;
      if (filters.outlets && p.outlets === 'none') return false;
      if (filters.noise !== 'any' && p.noise !== filters.noise) return false;
      if (filters.wifi !== 'any' && p.wifi !== filters.wifi) return false;
      if (filters.seats !== 'any' && p.seats !== filters.seats) return false;
      if (filters.minRating !== null && p.rating < filters.minRating) return false;
      return true;
    });
  }, [cityMeta.places, filters]);

  // Pan to the active city's center whenever it changes.
  useEffect(() => {
    mapRef.current?.panTo(cityMeta.center.lat, cityMeta.center.lng);
    setSelectedPlace(null);
  }, [cityMeta.center.lat, cityMeta.center.lng]);

  // On first onboard-checked render, ask the IP-geo endpoint and gently pan
  // the map there if the result is reasonably close to the active city.
  const ipPannedRef = useRef(false);
  useEffect(() => {
    if (!onboardChecked) return;
    if (ipPannedRef.current) return;
    ipPannedRef.current = true;

    void fetch('/api/geo')
      .then(async (r) => (r.status === 204 ? null : ((await r.json()) as { lat: number; lng: number })))
      .then((g) => {
        if (!g) return;
        const dKm = haversineKm(g.lat, g.lng, cityMeta.center.lat, cityMeta.center.lng);
        // Only nudge if the user is plausibly inside the city. Otherwise stay
        // on the city's center so the demo data stays visible.
        if (dKm < 80) mapRef.current?.panTo(g.lat, g.lng);
      })
      .catch(() => null);
  }, [onboardChecked, cityMeta.center.lat, cityMeta.center.lng]);

  const handleSelectPlace = (place: DemoPlace) => {
    setSelectedPlace(place);
    setPanel('place');
    mapRef.current?.panTo(place.lat, place.lng);
  };

  const handleOpenAddPlace = () => {
    setAddPlaceCenter(mapRef.current?.getCenter() ?? null);
    setAddPlaceOpen(true);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.panTo(pos.coords.latitude, pos.coords.longitude);
        setGeolocating(false);
      },
      () => setGeolocating(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  if (!onboardChecked) {
    return <div className="h-full w-full bg-[var(--map-bg)]" />;
  }

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
          places={visiblePlaces}
          onSelectPlace={handleSelectPlace}
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

        {/* "+" stays out of the way: hidden on mobile when a panel/drawer is
            open, shifted left of the floating card on desktop when open. */}
        <button
          type="button"
          onClick={handleOpenAddPlace}
          aria-label="Add a place"
          title="Add a place"
          className={`pointer-events-auto absolute bottom-[96px] z-30 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-float backdrop-blur-ios hover:bg-white transition-[right] duration-200 ${
            cardOpen ? 'hidden md:flex md:right-[392px]' : 'flex right-4'
          }`}
        >
          <Icon name="Plus" size={16} weight="bold" />
        </button>

        <AttributionPill />
      </main>

      {!isDesktop && (
        <PlaceCard
          place={selectedPlace}
          open={selectedPlace !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedPlace(null);
          }}
        />
      )}

      <FilterSheet open={filterOpen} onOpenChange={setFilterOpen} />

      <AddPlaceSheet
        open={addPlaceOpen}
        onOpenChange={setAddPlaceOpen}
        center={addPlaceCenter}
      />

      <LiveUpdateSheet
        place={liveUpdate.place}
        open={liveUpdate.place !== null}
        onOpenChange={(next) => {
          if (!next && liveUpdate.place) liveUpdate.dismiss(liveUpdate.place.id);
        }}
      />
    </div>
  );
}
