# Architecture

A flat index of where things live. Update when you add a route, store, or surface — don't re-grep when you can read this.

For invariants ("rules that, if violated locally, break the app globally") see [`docs/conventions.md`](docs/conventions.md).
For the high-level product spec, see [`workin-cafe-build-spec.md`](workin-cafe-build-spec.md).

## Routes (App Router)

| Path | File | Purpose |
| --- | --- | --- |
| `/` | `app/(map)/page.tsx` | Map + sidebar; gates onboarding via `wic:onboarded`; auto-pans via `/api/geo` |
| `/welcome` | `app/welcome/page.tsx` | First-use modal (3 slides + X close); sets `wic:onboarded` |
| `/auth` | `app/auth/page.tsx` | Google / Apple / demo sign-in; reads `?next=` |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth code exchange; validates `next` is a relative path |
| `/profile` | `app/profile/page.tsx` | Authed user profile (protected) |
| `/place/[id]` | `app/place/[id]/page.tsx` | Full place profile (back button → `/`) |
| `/review/new/[placeId]` | `app/review/new/[placeId]/page.tsx` | Review form; signed-out users can fill, sign-in required at submit |
| `/admin/...` | `app/admin/**` | Admin (protected): `/admin`, `/admin/place-requests`, `/admin/flagged-reviews`, `/admin/ownership-claims`, `/admin/users` |
| `/owner` | `app/owner/page.tsx` | Owner dashboard (lists `place_owners` for the signed-in user) |
| `/place/[id]/claim` | `app/place/[id]/claim/page.tsx` | Owner-claim wizard (proof + email) |
| `/waitlist/partners` | `app/waitlist/partners/page.tsx` | "Friends" destination (will become the friend-profile wizard in PR 3) |

Protected prefixes (defined in `middleware.ts`): `/profile`, `/admin`. **`/review/new` is intentionally NOT protected** — auth happens on submit.

## API routes

| Path | Method | Auth | Notes |
| --- | --- | --- | --- |
| `/api/reviews` | POST | required (401) | Geo-verified within `GEO_VERIFY_METERS` (500 m); 5/user/day limit; ratings 1–10 |
| `/api/reviews/[id]/photos` | POST | required (401) | Records `{ slot, path }[]` rows after Storage upload; soft-503 if table missing |
| `/api/weather` | GET | none | open-meteo proxy by `?lat&lng`; 30 min cache; soft-fail returns `{}` |
| `/api/place-claims` | POST | required | Submit a place ownership claim |
| `/api/place-claims/[id]/decision` | POST | admin | Approve (creates `place_owners` row) or reject |
| `/api/stripe/onboard` | POST/GET | required | Create Connect account + onboarding link / read status |
| `/api/stripe/refresh` | GET | required | Re-mint expired onboarding links |
| `/api/stripe/webhook` | POST | none (signature) | Verifies Stripe signature; idempotent dispatch on payment + account events |
| `/api/me` | GET | none | Returns `{ signedIn, name, email, isDemo }` for client-side gating |
| `/api/friend-profiles` | GET/PUT | required | Read own friend profile / upsert |
| `/api/places/[id]/reviews` | GET | none | Real reviews for a place; resolves demo IDs via place_source_refs |
| `/api/admin/users/search` | POST | admin | Email search across `auth.users` (service-role) |
| `/api/admin/users/[id]/admin` | POST | admin | Toggle `is_admin` on a user; refuses to demote the last admin |
| `/api/live-updates` | POST | required (401) | Right-now noise / seating / temperature snapshot |
| `/api/checkins` | POST | required (401) | Live review (geolocated) |
| `/api/favorites` | POST/DELETE | required (401) | Best-effort; client ignores 401/503 |
| `/api/wifi-tests` | POST | required | Speed-test sample |
| `/api/decibel` | POST | required | Aggregated dB only — never raw audio |
| `/api/speedtest/{blob,upload,ping}` | edge | none | Used by `lib/measurement/speedtest.ts` |
| `/api/auth/demo` | POST | none | Issues the demo-mode JWT cookie |
| `/api/geo` | GET | none | Approximate lat/lng from Vercel headers; 204 in dev |

All write routes return 503 / 404 cleanly when the underlying table is missing — clients treat that as "demo mode acceptable" and don't surface an error.

## State stores (`lib/store/`)

| Store | File | Persists | Owns |
| --- | --- | --- | --- |
| `useCity` | `city.ts` | `wic:city` (localStorage) | Active city; `CITIES` map; `findPlace(id)` |
| `useFilters` | `filters.ts` | — | Category/noise/wifi/seats/rating filters; `activeCount()` |
| `useToasts` | `toasts.ts` | — | Imperative toast queue; `<Toaster />` in root layout |

Other localStorage keys: `wic:onboarded`, `wic:favorites`, `wic:pending:{review,live-update,checkin}` (see `lib/auth/pending-submit.ts`).

## UI surfaces

| Component | File | When it renders | Notes |
| --- | --- | --- | --- |
| `MapContainer` | `components/map/MapContainer.tsx` | Always | MapLibre GL JS + OpenFreeMap tiles + supercluster; `forwardRef` exposes `panTo` / `getCenter` / `setUserLocation` |
| `PlaceSidebar` | `components/layout/PlaceSidebar.tsx` | `md:` and up | Place list + search + filter button (filter button only on desktop) |
| `BottomBar` | `components/bottom-bar/BottomBar.tsx` | All viewports, all routes except `/welcome`, `/auth`, `/review/new` | Profile / Work spots / Meetups; mounted in root layout |
| `PlaceCard` | `components/card/PlaceCard.tsx` | `< md`, place selected | Vaul drawer at fixed `h-[88dvh]` (single snap) |
| `FloatingPlaceCard` | `components/card/FloatingPlaceCard.tsx` | `md:` and up, place selected | Translucent top-right panel |
| `PlaceCardBody` | `components/card/PlaceCardBody.tsx` | Inside both card shells | **Edit only this one for card content** |
| `TopRightControls` | `components/map/TopRightControls.tsx` | Map page | Filter pill (mobile only) + GPS pill |
| `LiveUpdateSheet` | `components/review/LiveUpdateSheet.tsx` | Triggered by `useLiveUpdatePrompt` | Quick-update drawer with rotating optional question |
| `ReviewForm` | `components/review/ReviewForm.tsx` | At `/review/new/[placeId]` | Layout: geo CTA → Wi-Fi (measurement + manual fallback) → Noise (same) → Comfort sliders → Drink/food price chips → Environment slider with weather hint → Work-friendliness multi-select → Busy slider → Place type → Photos (4 slots) → Comment → Overall slider (auto-suggested) |
| `SliderRow` | `components/review/SliderRow.tsx` | Inside ReviewForm | 1–10 anchored slider primitive; native `<input type="range">` with custom track + thumb |
| `PhotoSlots` | `components/review/PhotoSlots.tsx` | Inside ReviewForm | 2×2 grid of 4 captioned photo slots; resize + EXIF strip via canvas before upload |
| `ScaleRow` | `components/review/ScaleRow.tsx` | (legacy) | Discrete 1–5 scale; still used by older surfaces |
| `FilterSheet` | `components/filters/FilterSheet.tsx` | Triggered from sidebar (desktop) or top-right pill (mobile) | |
| `AddPlaceSheet` | `components/map/AddPlaceSheet.tsx` | Triggered from "Add a place" CTA | |

Media-query split: `useMediaQuery('(min-width: 768px)')` in `app/(map)/page.tsx` chooses sidebar+floating vs bottom-bar+drawer.

## Auth flow

```
client                /auth                Supabase                /auth/callback         next path
  │                     │                     │                         │                    │
  ├ click sign-in ────► │                     │                         │                    │
  │                     ├ signInWithOAuth ──► │                         │                    │
  │                     │  (redirectTo=       │                         │                    │
  │                     │  /auth/callback     │                         │                    │
  │                     │  ?next=…)           │                         │                    │
  │                     │                     ├ provider login ─►       │                    │
  │                     │                     │ ◄────── code ─────────► │                    │
  │                     │                     │                         ├ validate next      │
  │                     │                     │                         ├ exchangeCodeForSession
  │                     │                     │                         └─ redirect ──────► (next)
```

`callback/route.ts:safeNextPath` rejects external URLs and protocol-relative paths.

## Submit-time auth (drafts → login → replay)

For users who aren't signed in when they hit submit:

1. Client POST to `/api/{reviews,live-updates,checkins}` returns 401.
2. Client calls `savePending(kind, placeId, payload)` from `lib/auth/pending-submit.ts`.
3. Client redirects to `/auth?next=<original_path>?submit=<kind>`.
4. After OAuth, callback returns to the original path with `?submit=<kind>`.
5. Page consumes the pending envelope (one-shot) and re-POSTs.

Replay handlers:
- `app/(map)/page.tsx` handles `submit=checkin` and `submit=live-update`.
- `components/review/ReviewForm.tsx` handles `submit=review` (refills the form, user re-clicks submit).

## Demo vs Live data

- Demo data lives in `lib/demo/{paris,toronto}-places.ts`. `lib/store/city.ts` exposes `CITIES` and `findPlace(id)` — these are the binding for the UI today.
- Live mode reads via Supabase clients in `lib/supabase/{client,server,middleware,admin}.ts`. API routes return 503/404 when the `places` table is missing — clients must tolerate this so the demo surface keeps working before migrations are applied.
- Category visuals: `lib/categories.ts` (color + Phosphor icon per category) and `lib/brand-logos.ts` (initials + brand color per chain). **Single source of truth** — every map bubble, sidebar avatar, card hero, and profile hero reads from these.

## Measurement

- `lib/measurement/speedtest.ts` — calls `/api/speedtest/{blob,upload,ping}` to compute Mbps. Throws typed `SpeedtestError { phase }`. One-shot retry per phase. Upload payload is zero-filled (see conventions on `crypto.getRandomValues` cap).
- `lib/measurement/decibel.ts` — `getUserMedia` + `AnalyserNode`; samples for 10 s. Only the aggregate dB number is uploaded; audio never leaves the device.
- `lib/review/scoring.ts` — `suggestOverall(...)` weighted mean for the overall slider; `ratingFromMbps10` / `ratingFromDb10` map raw measurements onto the 1–10 scale.
- `lib/review/anchors.ts` — anchored description copy for every slider in the form.
- `lib/review/photos.ts` — client-side resize + EXIF strip pipeline; per-slot metadata.
- `lib/weather/codes.ts` — open-meteo WMO weather code → friendly string.

## Format helpers

- `lib/format/stay-limit.ts` — `formatStayLimit(hours)` → `All day` / `Nh` / `—`.
- `lib/auth/pending-submit.ts` — `savePending` / `consumePending` / `buildAuthRedirect`.
- `lib/geo.ts` — `haversineMeters`, `isWithin`. Server-side check is authoritative.

## Verification commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # full Next.js build (slow on WSL)
npm run dev         # local dev on :3000
```
