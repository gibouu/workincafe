> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: native iOS program paused; see docs/decisions/source/01-reconstruction.md and the deferred register; branch state preserved in git. See `docs/RECONSTRUCTION.md`.

# Web Performance Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut Work in Cafe's web launch cost, eliminate avoidable map/list work, and establish measurable performance and accessibility gates for the shared consumer foundation.

**Architecture:** Preserve the existing Next.js and MapLibre product surface while introducing explicit loading boundaries, keyed TanStack Query resources, stable marker reconciliation, virtualized result lists, and a bounded same-origin PWA shell. Every optimization is measured against the checked-in bundle baseline and verified in production-mode browser tests.

**Tech Stack:** Next.js 16.2.9, React 19.2.7, TypeScript 5.6, MapLibre GL JS 5.24, TanStack Query 5.101, TanStack Virtual 3.14.6, Vitest 4.1.9, Playwright 1.61.1, axe-core Playwright 4.12.1.

## Global Constraints

- Tracking issue: [#300](https://github.com/gibouu/workincafe/issues/300); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- Preserve the existing public website, API behavior, owner/admin surfaces, Supabase RLS, and six-city dataset.
- Do not touch project data until `scripts/db` and `docs/DATABASE_ACCESS.md` exist; database query tuning belongs to issue #304.
- Keep primary touch targets at least 44 CSS pixels and keep landscape phones in the mobile layout.
- Service-worker caching is same-origin shell-only; never cache `/api/**`, OpenFreeMap, or map tiles.
- Every commit and PR body ends with `— gib` and contains no AI trailer.
- Required final commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run bundle:check`, and `npm run test:e2e`.

---

## File map

- Bundle evidence: `scripts/lib/bundle-stats.ts`, `scripts/check-bundle.ts`, `config/bundle-baseline.json`, `config/bundle-budgets.json`.
- Loading/data boundary: `app/providers.tsx`, `lib/places/client-queries.ts`, `hooks/useViewportPlaces.ts`, `app/(map)/page.tsx`, `components/card/PlaceCardBody.tsx`.
- Rendering boundary: `components/icons/Icon.tsx`, `components/layout/SearchPanel.tsx`, `components/map/MapContainer.tsx`, `lib/map/marker-reconciliation.ts`.
- PWA/accessibility boundary: `public/`, `app/manifest.ts`, `app/layout.tsx`, `app/globals.css`, `components/pwa/ServiceWorkerRegistration.tsx`, `components/ui/Modal.tsx`.
- Browser verification: `playwright.config.ts`, `e2e/helpers/map-fixtures.ts`, `e2e/map-*.spec.ts`, `e2e/pwa.spec.ts`.

### Task 1: Add reproducible bundle measurement and budgets

**Files:**
- Create: `scripts/lib/bundle-stats.ts`
- Create: `scripts/check-bundle.ts`
- Create: `config/bundle-baseline.json`
- Create: `config/bundle-budgets.json`
- Create: `tests/bundle-stats.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `RouteBundleStat`, `BundleBudgets`, `readRouteBundleStats()`, and `compareBundleStats()` for every later performance task.
- Consumes: `.next/diagnostics/route-bundle-stats.json` produced by `next build`.

- [ ] **Step 1: Write the failing budget-comparison test**

```ts
import { describe, expect, it } from 'vitest';
import { compareBundleStats, type RouteBundleStat } from '@/scripts/lib/bundle-stats';

describe('compareBundleStats', () => {
  it('reports a root-route gzip regression above its absolute budget', () => {
    const current: RouteBundleStat[] = [
      { route: '/', uncompressedBytes: 3_000_000, gzipBytes: 910_000, chunks: ['root.js'] },
    ];
    expect(compareBundleStats(current, { '/': { maxBytes: 3_500_000, maxGzipBytes: 900_000 } }))
      .toEqual([{ route: '/', metric: 'gzipBytes', actual: 910_000, limit: 900_000 }]);
  });
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npm test -- tests/bundle-stats.test.ts`

Expected: FAIL because `scripts/lib/bundle-stats.ts` does not exist.

- [ ] **Step 3: Implement the typed comparison core**

```ts
export interface RouteBundleStat {
  route: string;
  uncompressedBytes: number;
  gzipBytes: number;
  chunks: string[];
}

export type BundleBudgets = Record<string, { maxBytes: number; maxGzipBytes: number }>;

export interface BudgetFailure {
  route: string;
  metric: 'uncompressedBytes' | 'gzipBytes';
  actual: number;
  limit: number;
}

export function compareBundleStats(
  current: readonly RouteBundleStat[],
  budgets: BundleBudgets,
): BudgetFailure[] {
  return current.flatMap((stat) => {
    const budget = budgets[stat.route];
    if (!budget) return [];
    const failures: BudgetFailure[] = [];
    if (stat.uncompressedBytes > budget.maxBytes) {
      failures.push({ route: stat.route, metric: 'uncompressedBytes', actual: stat.uncompressedBytes, limit: budget.maxBytes });
    }
    if (stat.gzipBytes > budget.maxGzipBytes) {
      failures.push({ route: stat.route, metric: 'gzipBytes', actual: stat.gzipBytes, limit: budget.maxGzipBytes });
    }
    return failures;
  });
}
```

- [ ] **Step 4: Add the parser, CLI, scripts, and initial measured configuration**

Use the diagnostics JSON as the source of chunk lists and compute gzip sizes from the emitted `.next` files. Check in this starting baseline:

```json
{
  "/": {
    "uncompressedBytes": 8284854,
    "gzipBytes": 1907701
  }
}
```

Add these scripts:

```json
{
  "bundle:report": "tsx scripts/check-bundle.ts --report",
  "bundle:check": "tsx scripts/check-bundle.ts --check"
}
```

Start with a 10% regression ceiling; after Tasks 2 and 3, change the `/` absolute gate to 3,500,000 uncompressed bytes and 900,000 gzip bytes.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/bundle-stats.test.ts && npm run build && npm run bundle:report && npm run bundle:check`

Expected: tests PASS, the report reproduces the checked-in baseline, and the check exits 0.

```bash
git add scripts/lib/bundle-stats.ts scripts/check-bundle.ts config package.json package-lock.json .github/workflows/ci.yml tests/bundle-stats.test.ts
git commit -m "test: add web bundle performance budgets" -m "— gib"
```

### Task 2: Replace the Phosphor namespace with an explicit icon registry

**Files:**
- Modify: `components/icons/Icon.tsx`
- Modify: `eslint.config.mjs`
- Create: `tests/icon-registry.test.ts`

**Interfaces:**
- Preserves: `<Icon name={PhosphorIconName} ... />`.
- Produces: `ICON_REGISTRY` and `PhosphorIconName = keyof typeof ICON_REGISTRY`.

- [ ] **Step 1: Write the failing registry-source test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Icon registry', () => {
  it('uses explicit Phosphor imports and covers category icons', async () => {
    const source = readFileSync(join(process.cwd(), 'components/icons/Icon.tsx'), 'utf8');
    expect(source).not.toContain('import * as Phosphor');
    const { ICON_REGISTRY } = await import('@/components/icons/Icon');
    for (const name of ['Coffee', 'Bread', 'BookOpen', 'Briefcase', 'Bed', 'ForkKnife', 'Hamburger', 'MapPin']) {
      expect(ICON_REGISTRY).toHaveProperty(name);
    }
  });
});
```

- [ ] **Step 2: Verify the test fails on the namespace import**

Run: `npm test -- tests/icon-registry.test.ts`

Expected: FAIL with the namespace-import assertion.

- [ ] **Step 3: Implement explicit imports and the finite registry**

Import every current icon directly, including category icons, `NavigationArrow`, Wi-Fi icons, speaker icons, `Sun`, and `SunDim`, then expose the registry:

```tsx
'use client';

import {
  AppleLogo, Armchair, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowsMerge,
  Bed, BookOpen, Brain, Bread, Briefcase, Broadcast, Camera, CaretDown,
  CaretLeft, CaretRight, CaretUp, ChatText, ChatsCircle, Check, CheckCircle,
  CheckSquare, Circle, CircleNotch, City, Clock, ClockCounterClockwise, Coffee,
  Compass, Copy, CreditCard, DotsThree, Drop, Empty, EnvelopeSimple, Eye,
  EyeSlash, FileText, Flag, ForkKnife, Gift, GoogleLogo, Hamburger, HandHeart,
  Heart, HourglassMedium, House, Info, Lightbulb, Lock, MagnifyingGlass,
  MapPin, MapPinLine, MapTrifold, Medal, Megaphone, NavigationArrow,
  PencilSimple, Phone, Plug, Plus, Prohibit, QrCode, Question, Scan, SignIn,
  SignOut, SlidersHorizontal, SmileyXEyes, Sparkle, SpeakerSimpleHigh,
  SpeakerSimpleLow, SpeakerSimpleSlash, Square, Star, Storefront, Student,
  Subway, Sun, SunDim, Thermometer, Trash, Tree, UserCircle, Users, UsersThree,
  Warning, WarningCircle, WifiHigh, WifiLow, WifiMedium, WifiSlash, X, XCircle,
} from '@phosphor-icons/react';
import type { IconProps, IconWeight } from '@phosphor-icons/react';

export const ICON_REGISTRY = {
  AppleLogo, Armchair, ArrowLeft, ArrowRight, ArrowSquareOut, ArrowsMerge,
  Bed, BookOpen, Brain, Bread, Briefcase, Broadcast, Camera, CaretDown,
  CaretLeft, CaretRight, CaretUp, ChatText, ChatsCircle, Check, CheckCircle,
  CheckSquare, Circle, CircleNotch, City, Clock, ClockCounterClockwise, Coffee,
  Compass, Copy, CreditCard, DotsThree, Drop, Empty, EnvelopeSimple, Eye,
  EyeSlash, FileText, Flag, ForkKnife, Gift, GoogleLogo, Hamburger, HandHeart,
  Heart, HourglassMedium, House, Info, Lightbulb, Lock, MagnifyingGlass,
  MapPin, MapPinLine, MapTrifold, Medal, Megaphone, NavigationArrow,
  PencilSimple, Phone, Plug, Plus, Prohibit, QrCode, Question, Scan, SignIn,
  SignOut, SlidersHorizontal, SmileyXEyes, Sparkle, SpeakerSimpleHigh,
  SpeakerSimpleLow, SpeakerSimpleSlash, Square, Star, Storefront, Student,
  Subway, Sun, SunDim, Thermometer, Trash, Tree, UserCircle, Users, UsersThree,
  Warning, WarningCircle, WifiHigh, WifiLow, WifiMedium, WifiSlash, X, XCircle,
} as const;

export type PhosphorIconName = keyof typeof ICON_REGISTRY;

export function Icon({ name, weight = 'regular', size = 22, className, ...rest }:
  { name: PhosphorIconName; weight?: IconWeight; size?: number; className?: string } & Omit<IconProps, 'weight' | 'size'>) {
  const Component = ICON_REGISTRY[name];
  return <Component weight={weight} size={size} className={className} {...rest} />;
}
```

The implementation list is complete only when the compiler accepts every existing `PhosphorIconName`; do not widen the type or restore a namespace lookup.

- [ ] **Step 4: Prevent the wildcard import from returning**

Add an ESLint `no-restricted-imports` rule for `@phosphor-icons/react` namespace imports outside `components/icons/Icon.tsx`, and keep direct imports confined to that registry.

- [ ] **Step 5: Verify the bundle change and commit**

Run: `npm test -- tests/icon-registry.test.ts && npm run typecheck && npm run lint && npm run build && npm run bundle:report`

Expected: tests PASS and the previous 5,027,127-byte wildcard chunk is absent.

```bash
git add components/icons/Icon.tsx eslint.config.mjs tests/icon-registry.test.ts config/bundle-baseline.json
git commit -m "perf: replace wildcard icon bundle" -m "— gib"
```

### Task 3: Add responsive and interaction-triggered loading boundaries

**Files:**
- Create: `lib/layout/breakpoints.ts`
- Create: `tests/map-route-loading.test.ts`
- Modify: `app/(map)/page.tsx`
- Modify: `components/card/PlaceCardBody.tsx`
- Modify: `components/card/PlaceDealsSection.tsx`
- Modify: `hooks/useMediaQuery.ts`

**Interfaces:**
- Produces: `DESKTOP_LAYOUT_QUERY = '(min-width: 768px) and (min-height: 600px)'`.
- Preserves: existing sheet props and map/sidebar selection behavior.

- [ ] **Step 1: Write a source-level loading-boundary regression test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('map route loading boundaries', () => {
  it('does not statically import optional panels from the map page', () => {
    const source = readFileSync(join(process.cwd(), 'app/(map)/page.tsx'), 'utf8');
    for (const moduleName of ['FloatingProfileCard', 'FloatingFriendsCard', 'FilterSheet', 'LiveUpdateSheet']) {
      expect(source).not.toMatch(new RegExp(`import\\s+\\{?\\s*${moduleName}`));
    }
    expect(source).toContain("dynamic(() => import(");
  });
});
```

- [ ] **Step 2: Verify it fails against the eager imports**

Run: `npm test -- tests/map-route-loading.test.ts`

Expected: FAIL on `FloatingProfileCard` or the first eager optional import.

- [ ] **Step 3: Introduce stable breakpoints and dynamic components**

```ts
export const DESKTOP_LAYOUT_QUERY = '(min-width: 768px) and (min-height: 600px)';
```

Use `next/dynamic` for profile/friend cards, filters, live updates, review/menu sheets, heatmap, review form, and QR UI. Render desktop sidebar content only when `isDesktop`; render the mobile drawer only while `mobileSearchOpen`. Keep a permanent CSS grid slot on desktop so the map does not resize after hydration.

- [ ] **Step 4: Lock the optimized root budget**

Update `config/bundle-budgets.json`:

```json
{
  "/": {
    "maxBytes": 3500000,
    "maxGzipBytes": 900000
  }
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/map-route-loading.test.ts && npm run typecheck && npm run build && npm run bundle:check`

Expected: root initial chunks exclude `opening_hours`, QR, review forms, profile, and friend panels and satisfy the budget.

```bash
git add app/'(map)'/page.tsx components/card components/layout hooks/useMediaQuery.ts lib/layout config/bundle-budgets.json tests/map-route-loading.test.ts
git commit -m "perf: defer optional map interfaces" -m "— gib"
```

### Task 4: Introduce explicit slim/full contracts and keyed queries

**Files:**
- Create: `app/providers.tsx`
- Create: `lib/places/client-queries.ts`
- Create: `hooks/useViewportPlaces.ts`
- Create: `tests/place-client-queries.test.ts`
- Create: `tests/places-route.test.ts`
- Modify: `app/layout.tsx`
- Modify: `lib/demo/paris-places.ts`
- Modify: `app/api/places/route.ts`
- Modify: `app/api/places/search/route.ts`
- Modify: `app/api/places/[id]/route.ts`
- Modify: `app/(map)/page.tsx`
- Modify: `components/card/PlaceCardBody.tsx`

**Interfaces:**
- Produces: `Bbox`, `ViewportCell`, `quantizeViewport()`, `placeKeys`, and `DemoPlace.isSlim`.
- Consumes: TanStack Query's `AbortSignal` in every fetch function.

- [ ] **Step 1: Write failing quantization and key tests**

```ts
import { describe, expect, it } from 'vitest';
import { placeKeys, quantizeViewport } from '@/lib/places/client-queries';

describe('place client queries', () => {
  it('maps bbox jitter to one cache cell', () => {
    expect(quantizeViewport([2.30001, 48.80001, 2.40001, 48.90001]).key)
      .toBe(quantizeViewport([2.30004, 48.80004, 2.40004, 48.90004]).key);
  });

  it('keys place resources by place ID', () => {
    expect(placeKeys.detail('a')).not.toEqual(placeKeys.detail('b'));
    expect(placeKeys.menus('a')).not.toEqual(placeKeys.menus('b'));
  });
});
```

- [ ] **Step 2: Verify the client-query module is missing**

Run: `npm test -- tests/place-client-queries.test.ts`

Expected: FAIL because `lib/places/client-queries.ts` does not exist.

- [ ] **Step 3: Implement stable cells, keys, and cancellable fetchers**

```ts
export type Bbox = readonly [number, number, number, number];
export interface ViewportCell { key: string; bbox: Bbox }

const round = (value: number) => Math.round(value * 1_000) / 1_000;

export function quantizeViewport(bbox: Bbox): ViewportCell {
  const rounded = bbox.map(round) as [number, number, number, number];
  return { key: rounded.join(','), bbox: rounded };
}

export const placeKeys = {
  viewport: (cellKey: string) => ['places', 'viewport', cellKey] as const,
  detail: (id: string) => ['places', 'detail', id] as const,
  reviews: (id: string, source: 'user' | 'imported', limit: number) =>
    ['places', id, 'reviews', source, limit] as const,
  menus: (id: string) => ['places', id, 'menus'] as const,
};

export async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Add query provider and explicit response shape**

Add `isSlim: true` to viewport/search items and `isSlim: false` to place detail. Treat demo fixtures without the property as full. Use stale times of 60 seconds for viewport, 30 seconds for detail/reviews, and five minutes for menus. Start detail, reviews, and menus concurrently on selection; never retain A's review/menu data while B is selected.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/place-client-queries.test.ts tests/places-route.test.ts tests/places-search-route.test.ts tests/map-place-target.test.ts && npm run typecheck`

Expected: stable-cell tests PASS, signals reach fetch, and slim/full route fixtures are explicit.

```bash
git add app/providers.tsx app/layout.tsx app/'(map)'/page.tsx app/api/places components/card/PlaceCardBody.tsx hooks/useViewportPlaces.ts lib/demo/paris-places.ts lib/places/client-queries.ts tests
git commit -m "perf: cache keyed place resources" -m "— gib"
```

### Task 5: Virtualize dense result lists with keyboard parity

**Files:**
- Create: `lib/search/place-results.ts`
- Create: `tests/search-place-results.test.ts`
- Create: `playwright.config.ts`
- Create: `e2e/helpers/map-fixtures.ts`
- Create: `e2e/map-density.spec.ts`
- Modify: `components/layout/SearchPanel.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `rankVisiblePlaces(places, query, anchor)` as a pure function.
- Consumes: `useVirtualizer({ count, getScrollElement, estimateSize: () => 61, overscan: 8 })`.

- [ ] **Step 1: Write a 5,000-place ordering test**

```ts
import { describe, expect, it } from 'vitest';
import { rankVisiblePlaces } from '@/lib/search/place-results';

describe('rankVisiblePlaces', () => {
  it('keeps deterministic ordering for 5,000 places', () => {
    const places = Array.from({ length: 5_000 }, (_, index) => ({
      id: String(index), name: `Cafe ${index.toString().padStart(4, '0')}`, lat: 48.8, lng: 2.3,
    }));
    const ranked = rankVisiblePlaces(places, 'Cafe 0499', null);
    expect(ranked[0]?.id).toBe('499');
  });
});
```

- [ ] **Step 2: Verify the pure ranking module is missing**

Run: `npm test -- tests/search-place-results.test.ts`

Expected: FAIL because `lib/search/place-results.ts` does not exist.

- [ ] **Step 3: Extract ranking and virtualize semantic rows**

Keep `ul/li`; add `aria-setsize`, `aria-posinset`, result-count status, selected state, and ArrowUp/ArrowDown handling that calls `virtualizer.scrollToIndex(nextIndex)`. Install exact versions with `npm install --save-exact @tanstack/react-virtual@3.14.6` and `npm install --save-dev --save-exact @playwright/test@1.61.1 @axe-core/playwright@4.12.1`.

- [ ] **Step 4: Add a production-mode density test**

```ts
test('bounds mounted rows and selects an offscreen result by keyboard', async ({ page }) => {
  await installMapFixture(page, { placeCount: 5_000 });
  await page.goto('/');
  const list = page.getByRole('list', { name: 'Places in current map area' });
  await expect.poll(async () => list.locator('li').count()).toBeLessThan(50);
  await list.press('End');
  await list.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

Use Playwright's local `expect.poll` assertion shown above; do not add a custom global matcher.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/search-place-results.test.ts && npm run build && npx playwright install chromium && npm run test:e2e -- e2e/map-density.spec.ts`

Expected: ordering PASS, fewer than 50 result rows are mounted, and keyboard selection reaches an offscreen item.

```bash
git add components/layout/SearchPanel.tsx lib/search tests/search-place-results.test.ts e2e playwright.config.ts package.json package-lock.json .github/workflows/ci.yml
git commit -m "perf: virtualize dense place results" -m "— gib"
```

### Task 6: Reconcile accessible map markers by stable identity

**Files:**
- Create: `lib/map/marker-reconciliation.ts`
- Create: `tests/marker-reconciliation.test.ts`
- Create: `e2e/map-markers.spec.ts`
- Modify: `components/map/MapContainer.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `MarkerDescriptor` and `diffMarkerDescriptors()`.
- Consumes: current Supercluster output and existing `onSelectPlace` callback.

- [ ] **Step 1: Write the failing identity-diff test**

```ts
import { describe, expect, it } from 'vitest';
import { diffMarkerDescriptors, type MarkerDescriptor } from '@/lib/map/marker-reconciliation';

describe('diffMarkerDescriptors', () => {
  it('updates a moved marker without removing it', () => {
    const oldMarker: MarkerDescriptor = { key: 'place:a', kind: 'place', placeId: 'a', coordinates: [2.3, 48.8], presentationKey: 'cafe', ariaLabel: 'Cafe A' };
    const next = { ...oldMarker, coordinates: [2.31, 48.81] };
    expect(diffMarkerDescriptors(new Map([[oldMarker.key, oldMarker]]), [next]))
      .toEqual({ add: [], update: [next], remove: [] });
  });
});
```

- [ ] **Step 2: Verify the reconciliation module is missing**

Run: `npm test -- tests/marker-reconciliation.test.ts`

Expected: FAIL because `lib/map/marker-reconciliation.ts` does not exist.

- [ ] **Step 3: Implement the descriptor diff**

```ts
export type MarkerDescriptor =
  | { key: `place:${string}`; kind: 'place'; placeId: string; coordinates: [number, number]; presentationKey: string; ariaLabel: string }
  | { key: `cluster:${number}:${number}`; kind: 'cluster'; clusterId: number; zoom: number; count: number; coordinates: [number, number]; presentationKey: string; ariaLabel: string };

export function diffMarkerDescriptors(previous: ReadonlyMap<string, MarkerDescriptor>, next: readonly MarkerDescriptor[]) {
  const nextByKey = new Map(next.map((item) => [item.key, item]));
  return {
    add: next.filter((item) => !previous.has(item.key)),
    update: next.filter((item) => {
      const old = previous.get(item.key);
      return old !== undefined && JSON.stringify(old) !== JSON.stringify(item);
    }),
    remove: [...previous.keys()].filter((key) => !nextByKey.has(key)),
  };
}
```

- [ ] **Step 4: Replace marker-array rebuilds with keyed entries**

Store `Map<string, { marker; element; descriptor; cleanup }>`; call `setLngLat` for coordinate-only updates and recreate only presentation changes. Use a real `<button type="button">` for each marker, Enter/Space/click parity, `aria-label`, and CSS `:hover`/`:focus-visible`; remove inline mouse handlers.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/marker-reconciliation.test.ts && npm run build && npm run test:e2e -- e2e/map-markers.spec.ts`

Expected: unchanged place IDs keep the same element identity after pan/zoom; removed entries clean listeners; keyboard activation opens the place.

```bash
git add components/map/MapContainer.tsx app/globals.css lib/map/marker-reconciliation.ts tests/marker-reconciliation.test.ts e2e/map-markers.spec.ts
git commit -m "perf: reconcile accessible map markers" -m "— gib"
```

### Task 7: Complete the bounded PWA shell and metadata

**Files:**
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `public/icons/icon-maskable-512.png`
- Create: `public/icons/apple-touch-icon.png`
- Create: `app/favicon.ico`
- Create: `app/opengraph-image.tsx`
- Create: `app/robots.ts`
- Create: `app/sitemap.ts`
- Create: `app/offline/page.tsx`
- Create: `public/sw.js`
- Create: `components/pwa/ServiceWorkerRegistration.tsx`
- Create: `e2e/pwa.spec.ts`
- Modify: `app/manifest.ts`
- Modify: `app/layout.tsx`

**Interfaces:**
- Produces: a production-only service-worker registration and versioned `wic-shell-*` cache.
- Consumes: local offline page, manifest, and icons only.

- [ ] **Step 1: Write the failing production PWA test**

```ts
test('serves manifest assets and keeps map tiles out of Cache Storage', async ({ page, request }) => {
  for (const path of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png']) {
    expect((await request.get(path)).status()).toBe(200);
  }
  await page.goto('/');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const cachedUrls = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async (name) => (await caches.open(name)).keys()))).flat().map((request) => request.url));
  expect(cachedUrls.some((url) => url.includes('openfreemap') || url.includes('/api/'))).toBe(false);
});
```

- [ ] **Step 2: Verify missing assets make the test fail**

Run: `npm run build && npm run test:e2e -- e2e/pwa.spec.ts`

Expected: FAIL with a 404 for the first missing icon.

- [ ] **Step 3: Add assets, metadata, and safe service-worker routing**

Remove the portrait orientation lock. Add `metadataBase`, Open Graph/Twitter metadata, manifest/icon declarations, robots, sitemap, and social image. In `public/sw.js`, reject non-GET, `/api/`, and cross-origin requests before any cache lookup; cache only `/offline`, manifest, and local icons; delete older `wic-shell-*` caches on activation.

- [ ] **Step 4: Register only in production**

```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js');
  }, []);
  return null;
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm run build && npm run test:e2e -- e2e/pwa.spec.ts`

Expected: icons and metadata return 200, offline navigation shows `/offline`, and no API/tile URL is cached.

```bash
git add public app components/pwa e2e/pwa.spec.ts
git commit -m "feat: add bounded PWA shell" -m "— gib"
```

### Task 8: Add the responsive, safe-area, motion, and accessibility gate

**Files:**
- Create: `components/ui/Modal.tsx`
- Create: `e2e/map-accessibility.spec.ts`
- Create: `e2e/map-responsive.spec.ts`
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/(map)/page.tsx`
- Modify: `components/bottom-bar/BottomBar.tsx`
- Modify: `components/map/TopRightControls.tsx`
- Modify: `components/map/AttributionPill.tsx`
- Modify: `components/map/GeolocateBlockedBanner.tsx`
- Modify: all Vaul sheet components listed in issue #300.

**Interfaces:**
- Produces: shared `--safe-top/right/bottom/left` tokens and a native-dialog `Modal` with focus restoration.
- Consumes: `DESKTOP_LAYOUT_QUERY` from Task 3 and Playwright/axe setup from Task 5.

- [ ] **Step 1: Write failing landscape and accessibility checks**

```ts
test('keeps an 844x390 phone in mobile layout with 44px controls', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await installMapFixture(page, { placeCount: 10 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /search/i })).toBeVisible();
  await expect(page.getByRole('complementary')).toBeHidden();
  const box = await page.getByRole('button', { name: /search/i }).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(44);
  expect(box?.height).toBeGreaterThanOrEqual(44);
});
```

- [ ] **Step 2: Verify the current desktop breakpoint/40px target fails**

Run: `npm run test:e2e -- e2e/map-responsive.spec.ts`

Expected: FAIL because the landscape phone renders the sidebar or the control is below 44px.

- [ ] **Step 3: Implement safe areas, target size, and reduced motion**

Add `viewportFit: 'cover'`, safe-area CSS variables, `:focus-visible`, and `@media (prefers-reduced-motion: reduce)`. Map `flyTo`/`fitBounds` uses duration `0` under reduced motion. Add `Drawer.Description` to every Vaul sheet and replace manual overlays with the native-dialog `Modal`.

- [ ] **Step 4: Add axe and keyboard-flow assertions**

Check zero serious/critical axe violations; Tab/Enter operates results and markers; Escape closes dialogs and restores focus; the sidebar/list is named “Places in current map area”.

- [ ] **Step 5: Run the complete milestone gate and commit**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run bundle:check && npm run test:e2e`

Expected: all checks PASS; `/` remains below 3.5 MB/900 KB; landscape phone stays mobile; keyboard, axe, offline, density, and marker identity suites pass.

```bash
git add app components e2e package.json package-lock.json playwright.config.ts
git commit -m "fix: complete mobile accessibility gates" -m "— gib"
```

## Milestone completion gate

- Build a fresh production bundle and attach `npm run bundle:report` before/after output to the PR.
- Record a 10-minute pan/select/dismiss trace with 1,000- and 5,000-place fixtures and attach CPU/memory evidence.
- Reopen the localhost visual companion after every material visual revision and resolve or link accepted notes.
- Open the PR with `Closes #300`, the full command output, browser matrix, and rollback notes; self-review the GitHub diff before merge.
