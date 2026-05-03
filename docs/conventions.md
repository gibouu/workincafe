# Project conventions

Rules that, if violated *locally*, break things *globally*. If you fix a bug here once, this is where to record what you learned so the next agent doesn't reintroduce it elsewhere.

## Phosphor icons must be `'use client'`

`components/icons/Icon.tsx` wraps Phosphor and **must** keep its `'use client'` directive. Phosphor's internal `context.es.js` calls `createContext` at import time, which crashes React Server Components.

- ✅ Server components may render `<Icon />` only via a client-component boundary.
- ❌ Never import `@phosphor-icons/react` directly — always go through `Icon`.
- If you add a new server component that uses `Icon`, ensure it crosses a client boundary.

## Category visuals come from two files only

Map bubbles, sidebar avatars, card heros, and profile heros must all derive from:

- `lib/categories.ts` — `categoryMeta(category)` → `{ color, icon }`
- `lib/brand-logos.ts` — `brandLogoFor(name)` → `{ initials, bg, fg }` (or `null`)

If a place looks wrong on the map but right in the card (or vice versa), check that the surface goes through these helpers. **Don't hardcode brand colors or category icons inline anywhere.**

## Demo fallback contract

API write routes (`/api/reviews`, `/api/live-updates`, `/api/checkins`, `/api/favorites`) return **503 or 404** when the database table is missing. Clients must treat these as soft success — the demo surface keeps working before migrations are applied.

- ✅ Show the user a friendly "saved!" toast on 503/404.
- ❌ Never show an error UI for 503/404 from these endpoints.
- 401 is handled separately — see "Submit-time auth" below.

## Submit-time auth

For reviews / live updates / check-ins:

- Middleware does **not** protect `/review/new/...` — signed-out users can fill the form.
- Client receives 401 from the API only at submit. At that point:
  1. Save the draft via `savePending(kind, placeId, payload)` from `lib/auth/pending-submit.ts`.
  2. Redirect to `buildAuthRedirect(currentPath, marker)`.
  3. After OAuth, the page consumes the pending envelope once and re-POSTs.

Don't add new "redirect-to-auth on form mount" gates for these flows.

## Supercluster: `[lng, lat]` not `[lat, lng]`

GeoJSON convention. `MapContainer.tsx` builds features as `coordinates: [p.lng, p.lat]`. If markers appear offshore in the Atlantic, this is the bug.

## `PlaceCardBody` is the only card content surface

Both `PlaceCard` (mobile drawer) and `FloatingPlaceCard` (desktop panel) wrap the same `PlaceCardBody`. **Edit fields, copy, and CTAs in `PlaceCardBody` only** — never duplicate them in either shell.

## Map-init effects must not be merged

`MapContainer.tsx` has two `useEffect`s: one initialises the MapKit instance, the other syncs annotations. Don't merge them — the MapKit instance is expensive to recreate, and merging causes the map to flash on every place change.

## Rendering Phosphor icons in MapKit annotations

MapKit annotation factories return raw `HTMLElement`. Use `renderToStaticMarkup(<Icon ... />)` and assign as `innerHTML` (see `renderPlaceBubble` / `renderClusterBubble`). Don't try to mount React inside MapKit annotations.

## `'use client'` checklist before merge

If you added a new component that uses any of the following, it must be a client component:

- React state / effects
- Browser APIs (`window`, `navigator`, `localStorage`)
- Phosphor icons (transitively, via `Icon`)
- Zustand stores (they call `useSyncExternalStore`)
- `vaul` `Drawer.*` primitives

## Don't upload raw audio

`lib/measurement/decibel.ts` runs entirely in-browser. Only the aggregate dB number ever leaves the device. If you change this, get explicit user approval first.

## Geo verification is server-authoritative

`/api/reviews` checks `isWithin(...)` against the place's stored coordinates server-side. Don't move the check client-only.

## Ratings are 1–10 site-wide

`reviews.*_rating` columns and the form sliders use a 1–10 integer scale (`005_review_v2.sql`). Pre-2026 rows stored on the original 1–5 scale are read **as-is** — they live in the lower half of the new range. Don't rescale legacy rows on read; if a precise mix ever matters, do a one-shot upscale in SQL.

`lib/review/scoring.ts` is the single source of truth for `suggestOverall` (weighted mean) and `ratingFromMbps10` / `ratingFromDb10` mappings. Don't duplicate the formula client-side.

## Speedtest upload payload must not be filled with `crypto.getRandomValues`

Browsers cap `crypto.getRandomValues(view)` at 65536 bytes per call. The Wi-Fi speed test in `lib/measurement/speedtest.ts:uploadMbps` ships a 2 MB buffer — a single `getRandomValues(...)` call on it throws `QuotaExceededError`. The buffer is sent uncompressed (`octet-stream`, `cache-control: no-store`), so a zero-filled `Uint8Array(size)` measures throughput exactly the same. Don't reintroduce the random fill.

## Owner privileges go through `place_owners` only

Anything that requires "is this user the owner of this place?" must check `place_owners` (active row, `revoked_at is null`). There is no `users.is_owner` flag; ownership is a per-place relation, not a global role. Use `isOwnerOf(db, placeId, userId)` from `lib/auth/request-actor.ts`. RLS on `deals`, `deal_purchases`, `deal_uses` already gates writes through this table.

## Loyalty point events are server-issued only

`point_events` has no public RLS insert/update/delete policy. Points are issued exclusively by server actions tied to verified events (e.g. `deal_uses` insert by an owner). Don't reach for the service role from a client component to award points; route through an API endpoint that validates the underlying action.

## Stripe gating goes through `lib/payments/env.ts:isStripeEnabled()`

Anything that hits the Stripe SDK must short-circuit when `STRIPE_SECRET_KEY` is unset and fall back to the demo path. `lib/payments/stripe.ts` throws on use without keys — guard with `isStripeEnabled()` first. Webhook + onboard routes return 503 when disabled. The owner UI's `PayoutsCard` reads the same gate via the `/api/stripe/onboard` GET endpoint and shows a "Demo mode" badge instead of the connect button.

## Don't add filters without a collection point

Every user-facing filter must have a structured way to be **collected** (review, quick-update, place request, owner claim, or admin) and a structured way to be **updated**. If you can't answer "where does this attribute come from?", the filter doesn't ship.
