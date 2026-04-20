'use client';

import { useEffect, useState } from 'react';
import { haversineMeters } from '@/lib/geo';
import type { DemoPlace } from '@/lib/demo/paris-places';

const DWELL_RADIUS_M = 100;
const DWELL_REQUIRED_MS = 15 * 60 * 1000;
const POLL_MS = 30_000;
const PROMPT_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const DISMISSED_KEY = 'wic:live-update-dismissed';

interface DismissedMap {
  [placeId: string]: number;
}

function loadDismissed(): DismissedMap {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '{}') as DismissedMap;
  } catch {
    return {};
  }
}

function saveDismissed(map: DismissedMap) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export interface LiveUpdatePromptState {
  place: DemoPlace | null;
  dismiss: (placeId: string) => void;
}

export function useLiveUpdatePrompt(places: DemoPlace[]): LiveUpdatePromptState {
  const [place, setPlace] = useState<DemoPlace | null>(null);

  useEffect(() => {
    if (!navigator.geolocation || places.length === 0) return;

    let dwellStart = 0;
    let currentTargetId: string | null = null;
    let stopped = false;

    const poll = () => {
      if (stopped || document.visibilityState !== 'visible') return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (stopped) return;
          const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          let nearest: { place: DemoPlace; meters: number } | null = null;
          for (const p of places) {
            const m = haversineMeters(userLoc, { lat: p.lat, lng: p.lng });
            if (m <= DWELL_RADIUS_M && (!nearest || m < nearest.meters)) {
              nearest = { place: p, meters: m };
            }
          }

          if (!nearest) {
            dwellStart = 0;
            currentTargetId = null;
            return;
          }
          if (nearest.place.id !== currentTargetId) {
            dwellStart = Date.now();
            currentTargetId = nearest.place.id;
            return;
          }

          const dismissed = loadDismissed();
          const lastDismiss = dismissed[nearest.place.id] ?? 0;
          if (Date.now() - lastDismiss < PROMPT_COOLDOWN_MS) return;

          if (Date.now() - dwellStart >= DWELL_REQUIRED_MS) {
            setPlace(nearest.place);
          }
        },
        () => {
          // permission denied or error — quietly stop
          stopped = true;
        },
        { enableHighAccuracy: true, timeout: 8000 },
      );
    };

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [places]);

  const dismiss = (placeId: string) => {
    const map = loadDismissed();
    map[placeId] = Date.now();
    saveDismissed(map);
    setPlace(null);
  };

  return { place, dismiss };
}
