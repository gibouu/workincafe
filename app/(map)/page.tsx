'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, type MapHandle } from '@/components/map/MapContainer';
import { PlaceCard } from '@/components/card/PlaceCard';
import { FloatingPlaceCard } from '@/components/card/FloatingPlaceCard';
import { TopRightControls } from '@/components/map/TopRightControls';
import { BottomBar } from '@/components/bottom-bar/BottomBar';
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
import { useCity, CITIES } from '@/lib/store/city';
import type { DemoPlace } from '@/lib/demo/paris-places';

export default function MapPage() {
  const [selectedPlace, setSelectedPlace] = useState<DemoPlace | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [addPlaceCenter, setAddPlaceCenter] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const city = useCity((s) => s.city);
  const cityMeta = CITIES[city];
  const filters = useFilters();
  const activeFilterCount = useFilters((s) => s.activeCount());

  const liveUpdate = useLiveUpdatePrompt(cityMeta.places);

  const visiblePlaces = useMemo(() => {
    return cityMeta.places.filter((p) => {
      if (!filters.categories.has(p.category)) return false;
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

  const handleSelectPlace = (place: DemoPlace) => {
    setSelectedPlace(place);
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

  return (
    <div className="flex h-full w-full">
      <PlaceSidebar
        places={visiblePlaces}
        selectedId={selectedPlace?.id ?? null}
        onSelect={handleSelectPlace}
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
        />

        {!isDesktop && (
          <div className="pointer-events-none absolute top-4 left-4 z-30">
            <div className="pointer-events-auto">
              <CitySwitcher compact />
            </div>
          </div>
        )}

        {isDesktop && (
          <FloatingPlaceCard place={selectedPlace} onClose={() => setSelectedPlace(null)} />
        )}

        {!selectedPlace && (
          <button
            type="button"
            onClick={handleOpenAddPlace}
            className={`pointer-events-auto absolute z-30 flex items-center gap-2 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--text-primary)] shadow-float backdrop-blur-ios hover:bg-white transition ${
              isDesktop ? 'bottom-5 right-5' : 'bottom-[96px] right-4'
            }`}
          >
            <Icon name="Plus" size={14} weight="bold" />
            <span>Add a place</span>
          </button>
        )}

        {!isDesktop && !selectedPlace && <BottomBar onSelectPlace={handleSelectPlace} />}

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
