# Work in Cafe — Master Build Specification (v3)

> **Domain:** workin.cafe
> **Legal entity (future):** Kuzog PAAS
> **Living document.** Hand phase-by-phase to Claude Code via §17.

---

## Changelog
- **v3** (this file) — icon system switched to Phosphor Icons (no emojis in product UI), photos dropped from MVP, full OpenStreetMap/Overpass API seeding strategy added (§11), admin moderation spec expanded (§12), Apple Sign In from day one, `flagged_reviews` table added.
- **v2** — renamed to Work in Cafe, Apple MapKit JS, two cities, time-of-day noise.
- **v1** — initial draft as Study Sp0t.

---

## 0. How to use this document
- **Decisions locked** in §2.
- **Claude Code** gets one phase at a time from §17. Do not dump the whole file.
- **Non-negotiables:** zero monthly SaaS spend for MVP, PWA-only, Apple Maps aesthetic, Phosphor icons, no user-uploaded photos in v1.

---

## 1. TL;DR

Work in Cafe is a **map-first PWA at workin.cafe** for finding places to work or study outside the home — cafés, libraries, coworking, hotel lobbies, restaurants, bakeries. Tuned to the remote-work use case: Wi-Fi, noise (including **time-of-day noise patterns**), outlets, seat comfort, table-time tolerance, price.

- **Primary user:** remote worker or student in Toronto or central Paris.
- **Core loop:** open → map with bubbles → tap → "can I work here?" card → go → check in → 30s geo-verified review.
- **Design north star:** walzr.com/sf-parking on Apple MapKit JS + Phosphor icons. Clean, translucent, Apple-native.
- **North star metric:** weekly verified check-ins / MAU.
- **Revenue (Phase 3+):** commission on in-app café promotions. Not in MVP.

---

## 2. Decisions (locked)

| # | Decision |
|---|---|
| D1 | PWA only. No native in MVP. |
| D2 | Apple MapKit JS for maps. Free within $99/yr Apple Dev membership quota. |
| D3 | Apple Maps for discovery; our Postgres is the product. `apple_place_id` as soft reference only. |
| D4 | Supabase free tier (Postgres + PostGIS + Auth + Storage + Realtime). |
| D5 | Vercel free tier for hosting. |
| D6 | Auth: Google OAuth + Apple Sign in with Apple JS, both from day one. No email/password, no magic link. |
| D7 | MVP geography: Toronto + Paris intramuros (20 arrondissements). |
| D8 | Name: **Work in Cafe** / `workin.cafe`. |
| D9 | Language: English only for v1. French via `next-intl` in v1.1. |
| D10 | **No user-uploaded photos in MVP.** Card hero = category color gradient + Phosphor icon. Photos in v1.1. |
| D11 | Bottom bar center icon: `Coffee` / `CoffeeFill` (Phosphor). |
| D12 | Monetization: free forever for users; revenue via café promotions, Phase 3+. |
| D13 | Legal entity: personal project MVP, Kuzog PAAS later. |
| D14 | Moderation: Gib single-handed via `/admin` queues, ~5–15 min/day. |
| D15 | Icon library: **Phosphor Icons** (`@phosphor-icons/react`). No emojis in product UI. |
| D16 | Place data seeding: **OpenStreetMap via Overpass API** (bulk) + Apple MapKit JS Search (on-demand) + user-submitted via `place_requests`. |

---

## 3. Risk register

### 3.1 Apple MapKit JS
- Apple Place IDs less stable than Google's → reconcile via `lat/lng + normalized_name_hash`.
- Paris small-business coverage patchy → OSM seed + user submissions compensate.
- 25k service calls/day quota → viewport-tile cache, max 1 Apple fill per tile per user per 24h.
- No built-in clustering → `supercluster` npm.
- JWT tokens required → `/api/mapkit-token` endpoint.

### 3.2 Wi-Fi test spoofing — accepted as best-effort with geo-verification.

### 3.3 Decibel variance — displayed as Quiet/Moderate/Loud buckets only, ≥3 samples required.

### 3.4 Time-of-day noise sparsity — category-mean fallback until 15 samples per place.

### 3.5 Rating gaming — per-review cap 5.0×, per-user per-venue 25% cap, Bayesian smoothing, decay floor 0.3.

### 3.6 Photos deferred — keeps MVP legally simple, storage free, moderation lighter.

### 3.7 OSM data freshness — monthly re-sync script to catch closures and openings.

### 3.8 Free-tier ceilings — paid upgrade needed at ~1k DAU / ~5k MAU.

---

## 4. Product definition

### 4.1 Primary user
Remote worker or student, 20–40, Toronto or central Paris. Decision priorities:
1. Seat when I arrive?
2. Wi-Fi actually works?
3. Outlet for my laptop?
4. How loud right now?
5. How much to justify the seat for 2–3h?

### 4.2 Not building
Not Yelp. Not a social network. Not a booking platform. Not a productivity app.

### 4.3 Metrics
- **North star:** weekly verified check-ins / MAU
- **Guardrails:** % geo-verified reviews (>70%), coverage within 1km (>80%), median time-to-second-review (<14 days)

---

## 5. Technical stack

| Layer | Choice | Cost |
|---|---|---|
| Framework | Next.js 15 App Router | free |
| Language | TypeScript strict | free |
| Styling | Tailwind + shadcn/ui | free |
| **Icons** | **Phosphor Icons (`@phosphor-icons/react`)** | free |
| State | Zustand + TanStack Query | free |
| DB + Auth + Storage | Supabase free tier | $0 to ~1k DAU |
| Map | Apple MapKit JS | $0 within $99/yr Apple Dev quota |
| PWA | serwist | free |
| Hosting | Vercel free | $0 to ~100GB/mo |
| Analytics | PostHog Cloud free | $0 to 1M events/mo |
| Errors | Sentry free | $0 to 5k events/mo |
| Bulk seed data | OpenStreetMap via Overpass API | $0, no API key |
| Domain | workin.cafe | ~$40/yr |
| **TOTAL monthly SaaS** | | **$0** |

### 5.1 Folder structure
```
/app
  /(map)
    page.tsx
    layout.tsx
  /place/[id]/page.tsx
  /review/new/[placeId]/page.tsx
  /profile
    page.tsx
    /favorites
    /reviews
  /admin
    /place-requests/page.tsx
    /flagged-reviews/page.tsx
  /api
    /places/nearby
    /places/[id]
    /places/request
    /places/ingest-apple
    /reviews
    /checkins
    /wifi-tests
    /decibel
    /mapkit-token
    /admin/*
/components
  /map         # MapContainer, PlaceAnnotation, Cluster
  /card        # PlaceCard, NoiseHeatmap
  /filters     # FilterSheet, FilterChip
  /review      # ReviewFlow, StarRating, WifiTest, DecibelTest
  /bottom-bar  # BottomBar, SearchPill
  /icons       # Typed Phosphor wrapper (consistent weight/size)
  /ui          # shadcn primitives
/lib
  /supabase
  /mapkit      # JWT + client + Search helper + fill-viewport
  /rating
  /geo         # tile hashing, distance, bbox
  /osm         # Overpass client + tag mapper
  /brand-logos.ts
/scripts
  /seed-osm.ts
  /seed-overpass-paris.ql
  /seed-overpass-toronto.ql
/hooks
/types
/public
  /icons       # PWA icons
  /brand-logos
```

---

## 6. Icon system

### 6.1 Library: Phosphor Icons
```bash
pnpm add @phosphor-icons/react
```

MIT-licensed, 6 weights (thin / light / regular / bold / fill / duotone), tree-shakeable, aesthetically closest to Apple SF Symbols without Apple's platform-use restrictions.

### 6.2 Weight conventions
- **Default:** `regular`
- **Active/selected:** `fill`
- **Disabled/coming-soon:** `regular` at 50% opacity

### 6.3 Icon wrapper

`/components/icons/Icon.tsx`:
```tsx
import * as Phosphor from "@phosphor-icons/react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";

type PhosphorIconName = keyof typeof Phosphor;

export function Icon({
  name, weight = "regular", size = 22, className, ...rest
}: {
  name: PhosphorIconName;
  weight?: IconWeight;
  size?: number;
  className?: string;
} & Omit<IconProps, "weight" | "size">) {
  const Component = Phosphor[name] as React.ComponentType<IconProps>;
  return <Component weight={weight} size={size} className={className} {...rest} />;
}
```

Always import via this wrapper to keep size and weight consistent.

### 6.4 Icon registry

| Surface | Icon | Weight (default / active) |
|---|---|---|
| **Bottom bar** | | |
| Profile | `UserCircle` | regular / fill |
| Home (cafe) | `Coffee` | regular / fill |
| Partners (stub) | `UsersThree` | regular @ 50% opacity |
| Search | `MagnifyingGlass` | regular |
| **Top-right controls** | | |
| Filter | `SlidersHorizontal` | regular |
| Geolocate | `NavigationArrow` | regular / fill |
| **Map markers (category)** | | |
| Café | `Coffee` | regular |
| Bakery | `Bread` | regular |
| Library | `BookOpen` | regular |
| Coworking | `Briefcase` | regular |
| Hotel | `Bed` | regular |
| Restaurant | `ForkKnife` | regular |
| Fast food | `Hamburger` | regular |
| Other | `MapPin` | regular |
| **Card stat tiles** | | |
| Wi-Fi | `WifiHigh` / `WifiMedium` / `WifiLow` | regular (by bucket) |
| Noise | `SpeakerSimpleLow` / `SpeakerSimpleHigh` | regular |
| Outlets | `Plug` | regular |
| Seats | `Armchair` | regular |
| Lighting | `Sun` / `SunDim` | regular |
| Table-time | `Clock` | regular |
| Temperature | `Thermometer` | regular |
| **Other** | | |
| Favorite | `Heart` | regular / fill |
| Review | `PencilSimple` | regular |
| Check-in | `MapPinLine` | regular |
| Directions | `ArrowRight` | regular |
| Flag review | `Flag` | regular |
| Close | `X` | regular |
| Info | `Info` | regular |
| Spinner | `CircleNotch` (animate-spin) | regular |

### 6.5 Marker rendering

Map bubble = 40px circle. If brand logo known (from `/lib/brand-logos.ts`) → logo img. Else Phosphor category icon at 22px white on category-tinted background:

| Category | BG color |
|---|---|
| Café | `#6B4F3B` |
| Bakery | `#D4A574` |
| Library | `#2C3E50` |
| Coworking | `#16A085` |
| Hotel | `#8E44AD` |
| Restaurant | `#C0392B` |
| Fast food | `#E67E22` |
| Other | `#5A5A60` |

White 2px border, drop shadow, tap states as v2.

---

## 7. Visual design

### 7.1 Philosophy
Apple-native. Map is hero. Floating translucent blurred surfaces. No heavy chrome.

### 7.2 Colors

| Token | Light | Dark |
|---|---|---|
| `--bg-map` | native MapKit beige | native MapKit dark |
| `--surface` | `rgba(255,255,255,0.85)` + blur 24px | `rgba(28,28,30,0.85)` + blur 24px |
| `--surface-border` | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.08)` |
| `--text-primary` | `#000` | `#FFF` |
| `--text-secondary` | `#6B7280` | `#9CA3AF` |
| `--accent` | `#007AFF` | `#0A84FF` |
| `--accent-green` | `#34C759` | `#30D158` |
| `--accent-red` | `#FF3B30` | `#FF453A` |
| `--accent-amber` | `#FF9500` | `#FF9F0A` |

### 7.3 Typography
`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', Inter, sans-serif`. Scale 11/13/15/17/22/28/34. Weights 400/500/600/700.

### 7.4 Place card

**No photo hero.** Instead: a **category-tinted gradient band** 60px tall, gradient from category color (top) to transparent (bottom), with a large Phosphor category icon (40px, white) centered. Clean, on-brand, zero storage cost.

```
┌──────────────────────────────────────┐
│ ▰▰▰▰▰▰▰▰  [Coffee icon 40px]  ▰▰▰▰▰  │ ← category gradient band
├──────────────────────────────────────┤
│  De Mello Coffee                  ×  │
│  1236 Yonge St · 0.3 km              │
│                                      │
│  ┌─────────┐  ┌─────────┐            │
│  │   4.6   │  │   $5    │            │
│  │ Rating  │  │Avg spend│            │
│  └─────────┘  └─────────┘            │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Take me there   →              │  │
│  └────────────────────────────────┘  │
│                                      │
│  [Leave review] [Check in]  [♡ fav]  │
│                                      │
│  Study vitals                        │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ Wifi │ │Speak │ │ Plug │          │
│  │ Fast │ │Quiet │ │ Many │          │
│  └──────┘ └──────┘ └──────┘          │
│  ┌──────┐ ┌──────┐ ┌──────┐          │
│  │ Chair│ │ Sun  │ │Clock │          │
│  │Comfy │ │ Good │ │  2h+ │          │
│  └──────┘ └──────┘ └──────┘          │
│                                      │
│  Right now                           │
│  SpeakerHigh  Usually loud at 2pm    │
│  Armchair     Some seats (8 min ago) │
│                                      │
│  Recent check-ins (3)  MS RJ TS      │
│  Reviews (17) →                      │
└──────────────────────────────────────┘
```

(Icons are Phosphor components in the real render — ASCII is layout only.)

Snap points: 55% default / 90% dragged up. Swipe-down to dismiss.

### 7.5 Time-of-day noise heatmap (profile page)

Compact 7×24 grid. Cells green → amber → red by `mv_noise_heatmap.noise_score`. Empty cells hatched grey. Tap cell → tooltip "Tuesday 2pm · loud · 4 samples." Mobile: horizontal scroll with sticky day labels on the left.

---

## 8. Screen-by-screen UX

### 8.1 Main map (`/`)
Full-screen MapKit. Top-right vertical stack: filter pill + geolocate pill. Bottom: pill (3 slots) + separate search circle.

### 8.2 Place profile (`/place/[id]`)
Full-screen card expanded + tabs (Reviews / Info) + noise heatmap + sticky bottom CTAs.

### 8.3 Search
Tap 🔍 → bottom bar morphs into search pill. DB results first, MapKit Search fallback if <3.

### 8.4 Filter sheet (§14)
Bottom sheet from filter button. Sticky Apply with live result count.

### 8.5 Review flow (`/review/new/[placeId]`)
One scrollable screen: geo-gate → 9 star rows → Wi-Fi test → noise test → comment → submit. **No photo step.**

### 8.6 Live update prompt
Within 100m >15min + no review today. 4-question sheet, <30s.

### 8.7 Profile (`/profile`)
Tabs: My Places / My Reviews / My Stats (trust score).

### 8.8 Auth (`/auth`)
Two buttons: Continue with Google / Continue with Apple.

### 8.9 Admin (`/admin`)
See §12.

### 8.10 Partners stub
Tap 👥 Partners slot → sheet "Find a study partner — coming soon" + email capture → `waitlist_partners`.

---

## 9. Bottom bar

Default (pill + separate search):

```
┌──────────────────────────┐   ┌────┐
│  UserCircle  Coffee      │   │ Mag│
│    UsersThree  (SOON)    │   │nify│
└──────────────────────────┘   └────┘
```

- Pill ~280 × 64, 32px radius, `--surface`, blur 30px.
- Three slots. Active = `fill` weight + accent underline.
- Partners slot greyed 50% + "SOON" badge top-right.
- Search circle: 64px, same surface style.

Search-expanded:
```
┌────────────────────────────────────┐
│  MagnifyingGlass  Find a cafe…  GB │
└────────────────────────────────────┘
```

On place detail: bottom bar hides (card has its own CTAs).

---

## 10. Map rendering

| Zoom | Behavior |
|---|---|
| 10–12 | Aggressive cluster. Clusters + top 5 featured as bubbles. |
| 13–15 | Moderate cluster (threshold 40px). |
| 16–18 | No cluster, full bubbles + labels. |
| 19+ | Scale bubbles up slightly. |

Draw priority: `rating × log(review_count + 1) × is_favorite_boost`.

Live overlays: red ring if `current_seating=full` in last 20 min; gold dot if favorited.

---

## 11. Database propagation strategy

### 11.1 Three layers

1. **Bulk seed (pre-launch):** OpenStreetMap via Overpass API.
2. **On-demand runtime fill:** Apple MapKit JS Search when viewport is sparse.
3. **User submissions:** `place_requests` flow with Gib approval.

Plus a **monthly re-sync** for closures and openings.

### 11.2 Layer 1 — Overpass API bulk seed

**Why OSM:** free, no API key, no quota (fair-use only), great café/library/coworking coverage in both Paris and Toronto, rich tags (`internet_access`, `outdoor_seating`, `opening_hours`, etc.).

**Query for Paris** (`/scripts/seed-overpass-paris.ql`):
```overpassql
[out:json][timeout:120];
area["name"="Paris"]["admin_level"="6"]->.searchArea;
(
  node["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  node["tourism"="hotel"](area.searchArea);
  way["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  way["tourism"="hotel"](area.searchArea);
);
out body center;
```

For Toronto change `["name"="Paris"]` → `["name"="Toronto"]`.

Endpoint: `https://overpass-api.de/api/interpreter` (POST form-encoded with `data=<query>`).

**Seed script** (`/scripts/seed-osm.ts` sketch):
```ts
import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import crypto from "node:crypto";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CATEGORY_MAP: Record<string, string> = {
  cafe: "cafe",
  bakery: "bakery",
  library: "library",
  coworking_space: "coworking",
  fast_food: "fast_food",
  restaurant: "restaurant",
};

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

const hashKey = (name: string, lat: number, lng: number) =>
  crypto.createHash("sha1")
    .update(`${normalize(name)}|${lat.toFixed(4)}|${lng.toFixed(4)}`)
    .digest("hex").slice(0, 16);

async function seedCity(city: "Paris" | "Toronto", queryFile: string) {
  const query = await readFile(queryFile, "utf8");
  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
  });
  const { elements } = await resp.json();

  const places = elements
    .map((el: any) => {
      const tags = el.tags || {};
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (!tags.name || !lat || !lng) return null;
      const category =
        CATEGORY_MAP[tags.amenity] ??
        (tags.tourism === "hotel" ? "hotel" : "other");
      const address = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
      return {
        name: tags.name,
        address: address || null,
        city,
        country: city === "Paris" ? "FR" : "CA",
        lat, lng,
        category,
        brand: tags.brand || null,
        phone: tags.phone || tags["contact:phone"] || null,
        website: tags.website || tags["contact:website"] || null,
        hours_json: tags.opening_hours ? { raw: tags.opening_hours } : null,
        normalized_name_hash: hashKey(tags.name, lat, lng),
        osm_tags: {
          internet_access: tags.internet_access,
          outdoor_seating: tags.outdoor_seating,
          wheelchair: tags.wheelchair,
          cuisine: tags.cuisine,
          osm_type: el.type,
          osm_id: el.id,
        },
      };
    })
    .filter(Boolean);

  // Dedup + quality filter
  const unique = [...new Map(places.map((p) => [p.normalized_name_hash, p])).values()]
    .filter((p) => p.website || p.phone || p.brand); // cut low-quality listings

  for (let i = 0; i < unique.length; i += 500) {
    const batch = unique.slice(i, i + 500);
    await supabase.from("places").upsert(batch, { onConflict: "normalized_name_hash" });
    const refs = batch.map((p) => ({
      source: "osm",
      external_id: `${p.osm_tags.osm_type}/${p.osm_tags.osm_id}`,
      normalized_name_hash: p.normalized_name_hash,
    }));
    await supabase.from("place_source_refs").upsert(refs, { onConflict: "source,external_id" });
  }

  console.log(`Seeded ${unique.length} places for ${city}`);
}

await seedCity("Paris", "./scripts/seed-overpass-paris.ql");
await seedCity("Toronto", "./scripts/seed-overpass-toronto.ql");
```

### 11.3 Featured curation

Flag top ~200 per city as `featured=true` using signal heuristics:
- Has website
- `internet_access=wlan`
- `outdoor_seating=yes`
- Has phone
- Not a chain (independent > chain for featured)

Then manually eyeball the featured list (~30 min per city) to cut obvious junk.

### 11.4 Layer 2 — Apple MapKit JS on-demand fill

On map region-change, compute viewport tile hash. If DB has <5 places in that tile AND `apple_fill_log` shows no fill attempt by this user in last 24h, trigger a MapKit search:

```ts
async function fillViewportIfSparse(bbox, zoom, userId) {
  const tile = tileHash(bbox, zoom);
  if (sessionCache.has(tile)) return;
  sessionCache.add(tile);

  const { count } = await supabase
    .from("places").select("*", { count: "exact", head: true })
    .filter("geom", "st_within", bboxToPolygon(bbox));
  if ((count ?? 0) >= 5) return;

  const recent = await supabase
    .from("apple_fill_log")
    .select("id")
    .eq("user_id", userId).eq("tile_hash", tile)
    .gt("created_at", new Date(Date.now() - 86400000).toISOString())
    .maybeSingle();
  if (recent.data) return;

  const search = new mapkit.Search({ region: bboxToRegion(bbox) });
  const results = await new Promise((resolve) => {
    search.search("cafe", (err, data) => resolve(data?.places ?? []));
  });
  await fetch("/api/places/ingest-apple", {
    method: "POST",
    body: JSON.stringify({ places: results }),
  });
  await supabase.from("apple_fill_log").insert({ user_id: userId, tile_hash: tile });
}
```

Ingest endpoint upserts into `places` + `place_source_refs` with `source='apple'`.

At 1000 DAU × 3–5 fills/day = ~4k calls/day; quota is 25k. Ample headroom.

### 11.5 Layer 3 — User `place_requests`

Already spec'd. Button on map: "Can't find a place? Add it." Opens a sheet: name + category + optional notes. Lat/lng captured from current map center. POST to `/api/places/request`. Enters admin queue.

### 11.6 Monthly re-sync cron

Vercel cron or Supabase `pg_cron`, once a month:
1. Re-run Overpass for both cities.
2. Diff vs current `places` by `place_source_refs.external_id`:
   - New OSM nodes → insert.
   - Changed tags → update hours/phone/website.
   - OSM nodes missing → flag for closure review in admin queue.
3. Generate weekly coverage report: new adds, closures, neighborhood gaps.

### 11.7 Expected launch seed

Approximate Overpass + quality filter results:
- **Paris intramuros:** ~1,000 quality places.
- **Toronto:** ~900 quality places.

Enough for a usable launch map in both cities, with on-demand Apple fill catching edge cases and user submissions filling long-tail gaps.

---

## 12. Moderation

### 12.1 Three admin queues (all gated by `users.is_admin = true`)

**`/admin/place-requests`** — pending user-submitted places
- Row: mini-map (static MapKit snapshot), submitted name + lat/lng + category + notes, distance to nearest existing place.
- Actions: `Approve` (inserts `places` row with source=`user_submitted`), `Reject with reason` (freeform; user notified).
- Volume at 100 DAU: 2–10/day × 20s each = **~3 min/day.**

**`/admin/flagged-reviews`** — user-reported reviews
- Row: review text, place name, reporter reason (enum) + notes, review author trust score, geo-verification status.
- Actions: `Dismiss` / `Hide review` (soft delete + notify author) / `Ban user` (sets `users.is_banned=true`).
- Volume at 100 DAU: 1–2/day × 30s each = **~1 min/day.**

**`/admin/anomaly-scan`** (weekly, ~10 min)
- SQL query surfaces: new accounts with 5+ reviews in 24h, reviews from coordinates >5km from any place, identical comment text across users, sudden rating spikes.
- Manual review + ban or dismiss.

**Total time cost: ~5–15 min/day.**

### 12.2 Schema additions

```sql
create type flag_reason as enum ('spam','offensive','untrue','irrelevant','other');

create table public.flagged_reviews (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason flag_reason not null,
  notes text,
  status request_status default 'pending',
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz default now()
);

alter table public.users add column is_banned boolean default false;
alter table public.reviews add column is_hidden boolean default false;
```

Public read policy on `reviews` updated to exclude `is_hidden=true` except for author and admins.

### 12.3 Future automation (Phase 3+)
- Pre-screen `place_requests` with Claude API: plausibility of name + lat/lng + category. Auto-approve high-confidence, queue the rest.
- Pre-screen reviews for toxicity.
- Community moderators: trust_score >90 users get limited mod rights in their home city.

---

## 13. Review system

### 13.1 Dimensions (MVP)
1. Overall
2. Wi-Fi
3. Noise (hour + dow auto-stamped)
4. Seating comfort
5. Outlets
6. Price
7. Atmosphere / lighting
8. Temperature
9. Food (food-forward places only)

### 13.2 Two tracks
- **Full review** — §8.5, ≤90s target.
- **Quick live update** — §8.6, ≤30s.

### 13.3 Rotating question engine
Per-place least-sampled dimension → 4th question in live update.

### 13.4 Anti-abuse
- 5 reviews/user/day max
- ≥5 min between page-load and submit
- Server-side geo check (>150m rejected)
- Shadow-ban via `is_banned` or trust_score <0

---

## 14. Filters

Bottom sheet from filter button. All chip-based.

- **Business type** (multi): Café · Bakery · Library · Coworking · Hotel · Restaurant · Fast food — Phosphor icons per §6.4
- **Essentials** (toggles): Open now · Has Wi-Fi test · Power outlets · Outdoor seating · Pet-friendly
- **Price**: <$5 / $5–10 / $10–15 / $15–20 / $20+
- **Noise**: Quiet / Moderate / Loud / Any — plus toggle **"Quiet right now"** (joins `mv_noise_heatmap` at current hour+dow)
- **Wi-Fi**: Slow / Moderate / Fast / Any
- **Seating**: Plenty / Some / Any
- **Dietary** (multi): Vegan · Vegetarian · Gluten-free · Halal · Kosher · Dairy-free
- **Beverages** (collapsed multi): Coffee · Matcha · Tea · Bubble tea · Hot chocolate · Smoothies
- **Distance**: slider 0.1 → 20 km (default 2)
- **Rating**: ≥3.5 / ≥4.0 / ≥4.5 / Any

Active filter summary chip above map when any filter is on.

---

## 15. Rating algorithm (§from v2 §12)

Per-review weight capped at 5.0×. Per-user per-venue 25% cap. Bayesian smoothing C=8. Time decay with floor 0.3. Trust score 0–100 with "Veteran" badge for top 10%/city.

Display:
- <10 reviews → "No Work in Cafe rating yet — be the first"
- ≥10 → show rating + count

Full SQL in Appendix B.

---

## 16. MVP scope

### In
- [ ] PWA installable on iOS/Android/desktop
- [ ] Apple MapKit JS with custom-HTML annotations + clustering
- [ ] Phosphor icons everywhere (no emojis)
- [ ] Google + Apple OAuth (both day 1)
- [ ] OSM bulk seed (~1000 places/city) + Apple on-demand fill + `place_requests`
- [ ] Place card with category gradient hero + 6 vitals + "Right now" + check-in chips
- [ ] Full profile with 7×24 noise heatmap
- [ ] Full review with geo-gate (no photos)
- [ ] Quick live update prompt
- [ ] Wi-Fi speed test (self-hosted)
- [ ] Decibel test (Web Audio)
- [ ] Favorites
- [ ] All filters incl. "Quiet right now"
- [ ] Search (DB + Apple fallback)
- [ ] Rating v2 + trust score
- [ ] Profile with stats
- [ ] Admin: `/place-requests` + `/flagged-reviews`
- [ ] Report button on every review
- [ ] PostHog + Sentry
- [ ] Partner + Business waitlist stubs

### Out (Phase 2+)
- User photos
- French localization
- Business claim flow
- Café promotions (revenue)
- Partner matching
- Table reservations
- Push notifications
- Capacitor wrap

### Acceptance
- [ ] Cold-start to map + location: <3s on 4G
- [ ] Bubble tap → card: <500ms
- [ ] Full review submit: <90s for a new user
- [ ] "Cafés + Quiet right now + outlets + <1km" returns ≥3 results in both cities on launch
- [ ] PWA installs to iOS home screen, launches standalone
- [ ] Apple MapKit service calls < 2,000/day at 100 DAU

---

## 17. Claude Code prompts (per phase)

### 17.0 Phase 0 — Setup
```
I am building Work in Cafe, a map-first PWA at workin.cafe for finding
remote-work-friendly cafés. Read /docs/workin-cafe-build-spec.md end-to-
end, then do Phase 0:

1. Scaffold Next.js 15 (App Router, TypeScript strict, Tailwind).
2. Install: @supabase/supabase-js, @supabase/ssr, @phosphor-icons/react,
   zustand, @tanstack/react-query, date-fns, clsx, tailwind-merge,
   supercluster, jose, vaul.
3. Create a Supabase project; .env.local with
   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
   SUPABASE_SERVICE_ROLE_KEY.
4. Apple MapKit JS env vars: APPLE_TEAM_ID, APPLE_KEY_ID,
   APPLE_MAPKIT_PRIVATE_KEY (PEM, \n-escaped),
   NEXT_PUBLIC_APPLE_MAPKIT_ORIGIN=https://workin.cafe
5. /app/api/mapkit-token/route.ts: returns a 30-min ES256 JWT signed
   with the Apple key (Appendix C). Rate-limit 1 req/sec/IP.
6. /lib/mapkit/client.ts: loads Apple MapKit JS from Apple's CDN;
   authorize callback fetches /api/mapkit-token.
7. /components/icons/Icon.tsx: typed Phosphor wrapper with
   default weight='regular', size=22.
8. /app/(map)/page.tsx: full-screen mapkit.Map centered on Toronto
   (43.6532, -79.3832), zoom 13.
9. GitHub Actions: lint + typecheck + build on PR.
10. Deploy to Vercel. Add custom domain workin.cafe via Cloudflare DNS.

No markers, data, auth, UI yet. Conventional commits per step.
```

### 17.1 Phase 1 — Data + Auth + Admin gate
```
Implement Phase 1.

1. /supabase/migrations/001_init.sql per Appendix A — all extensions,
   enums (incl. flag_reason), tables (users + is_banned, places +
   osm_tags + featured, place_source_refs, place_requests, reviews +
   is_hidden, checkins, wifi_tests, decibel_samples, live_updates,
   favorites, waitlist_partners, waitlist_business, flagged_reviews,
   apple_fill_log), PostGIS, indexes, RLS, handle_new_user + set_time_columns
   triggers.
2. Supabase Auth: enable Google OAuth (Google Cloud Console OAuth app,
   redirect URIs for localhost + workin.cafe). Enable Apple Sign in
   with Apple JS (Apple Service ID + key + redirect URI; set
   SUPABASE_APPLE_CLIENT_ID + SUPABASE_APPLE_SECRET).
3. /lib/supabase/{client,server,middleware}.ts via @supabase/ssr.
4. /app/auth/page.tsx: two buttons (Google + Apple) using Phosphor
   icons. Success → redirect /.
5. Middleware: protect /profile, /review/new, /admin. Admin requires
   users.is_admin=true.
6. /app/profile/page.tsx: email + Sign Out button.
7. /app/admin/page.tsx: placeholder gated by is_admin.
8. npx supabase gen types typescript --linked > types/database.ts.

Commit each step.
```

### 17.2 Phase 2 — OSM seed + read-only map
```
Implement Phase 2.

1. /scripts/seed-overpass-paris.ql and /scripts/seed-overpass-toronto.ql
   per spec §11.2.
2. /scripts/seed-osm.ts per §11.2 code sketch. POST to Overpass,
   map OSM tags, dedupe by normalized_name_hash, quality-filter
   (require website OR phone OR brand), upsert into places +
   place_source_refs.
3. Run the script. Target: ~1000 quality places per city.
4. /components/map/MapContainer.tsx: mapkit.Map, 500ms-debounced
   region-change-end listener, calls /api/places/nearby?bbox=...
5. /api/places/nearby: PostGIS ST_MakeEnvelope + ST_Intersects on
   geom. In-memory 60s LRU cache.
6. /components/map/PlaceAnnotation.tsx: mapkit.Annotation subclass
   with factory returning a div: 40px circle, white 2px border,
   drop shadow. If brand in /lib/brand-logos.ts → logo img, else
   Phosphor category icon at 22px white on category-tint bg (§6.5).
7. Clustering via supercluster: ≥3 within 40px at current zoom →
   grey circle with count. Same visual style as the walzr clusters.
8. /components/card/PlaceCard.tsx: vaul-based bottom sheet. Hero =
   category-tint gradient band 60px with large Phosphor category
   icon 40px white centered. Stat tiles show "—" (data Phase 3).
9. Tap annotation → /api/places/[id] → open card.
10. Top-right controls: filter button (Phosphor SlidersHorizontal,
    opens empty sheet) + geolocate button (Phosphor NavigationArrow,
    navigator.geolocation → map.setCenter). Styling per §9.
11. /api/places/request POST (authenticated): validate lat/lng within
    Toronto or Paris bbox, insert into place_requests.

No reviews, no filters logic. Commit each step.
```

### 17.3 Phase 3 — Reviews + check-ins + live updates + heatmap
```
Implement Phase 3.

1. /app/review/new/[placeId]/page.tsx: geo-gate (reject if >150m),
   9 star rows using Phosphor Star/StarFill at 28px, Wi-Fi test
   button (stub returning fake value), noise test button (stub),
   comment (280 chars), submit.
2. /api/reviews POST: server-side geo verify. Trigger auto-populates
   hour_of_day + day_of_week from created_at.
3. /api/checkins POST: same geo check, insert.
4. /components/LiveUpdatePrompt.tsx: client hook polls geolocation
   every 30s when app is foregrounded. If within 100m of any place
   for >15min and no review today → show 4-question sheet.
5. /supabase/migrations/002_views.sql:
   - mv_place_ratings per spec §15 (Bayesian smoothing C=8, per-user
     25% cap, time decay floor 0.3). Includes per-dimension averages.
   - mv_noise_heatmap per Appendix B.
   - mv_current_live_status per Appendix B.
6. pg_cron: REFRESH MATERIALIZED VIEW CONCURRENTLY every 15 min.
7. Card stat tiles show real data from mv_place_ratings, bucketed
   per §7.4. Phosphor icons per §6.4.
8. "Right now" card section: current-hour noise from
   mv_noise_heatmap + current seating from mv_current_live_status.
9. /app/place/[id]/page.tsx: full profile + reviews list +
   /components/card/NoiseHeatmap.tsx (7×24 grid, tap for tooltip).

Commit each step.
```

### 17.4 Phase 4 — Filters + search
```
Implement Phase 4.

1. /components/filters/FilterSheet.tsx with all §14 sections.
   Zustand store. Persist to localStorage + users table.
2. /api/places/nearby: accept filter params, build PostGIS + WHERE.
   "Quiet right now" joins mv_noise_heatmap on current (dow, hour).
3. Active filter chip above map, dismissible, summary text.
4. Live result count on Apply button, 250ms debounce.
5. Search: tap 🔍 → morph bottom bar into search pill.
   Recent searches from localStorage.
6. /api/places/search: Postgres full-text + pg_trgm on name. In
   parallel (debounced 300ms, only if DB <3 results): mapkit.Search
   on Apple. Unified result type {kind: 'place' | 'address'}.
7. Tap place → zoom + card. Tap address → pan only.

Commit each step.
```

### 17.5 Phase 5 — Profile + favorites + admin queues
```
Implement Phase 5.

1. Favorite toggle (Phosphor Heart/HeartFill) on card + profile.
   /api/favorites upsert/delete.
2. /app/profile/page.tsx per §8.7: tabs for My Places / My Reviews
   / My Stats. Trust score shown as a badge with a Phosphor Medal icon.
3. Trust score computed via a Postgres function on review insert;
   cached on users.trust_score. Veteran badge = top 10% per city.
4. /app/admin/place-requests/page.tsx: table of pending requests
   with mini-map (static MapKit snapshot img), submitter info,
   Approve / Reject (with reason) buttons. Approve creates places
   row with source='user_submitted'.
5. /app/admin/flagged-reviews/page.tsx: similar table. Actions:
   Dismiss / Hide (soft delete) / Ban. Updates flagged_reviews.status
   and reviews.is_hidden / users.is_banned.
6. Report button (Phosphor Flag) on every review. Opens a sheet
   with flag_reason enum + notes. POST /api/reviews/[id]/flag.

Commit each step.
```

### 17.6 Phase 6 — Wi-Fi + decibel
```
Implement Phase 6.

1. /api/speedtest/blob: returns 5MB random bytes, no-cache headers.
   Client fetches with timing API, computes Mbps.
2. Upload test: /api/speedtest/upload accepts 2MB body. Ping: HEAD.
3. Progress UI (Phosphor CircleNotch animate-spin). Save to
   wifi_tests with navigator.connection.type.
4. Decibel: getUserMedia + AudioContext + AnalyserNode. Sample RMS
   every 100ms for 10s. Compute approx dB via 20*log10(rms). Never
   upload raw audio.
5. Save avg_db, peak_db + hour/dow (trigger) to decibel_samples.
6. Server-side geo-verify both. Reject if >150m.
7. Rate limits: 1 wifi/place/user/hour, 3 decibel/user/hour.

Commit each step.
```

### 17.7 Phase 7 — Apple fill + PWA + polish + launch
```
Implement Phase 7.

1. /lib/mapkit/fill-viewport.ts per §11.4. Tile-hash cache (session)
   + apple_fill_log DB check for 24h window. mapkit.Search("cafe")
   bounded to viewport. POST to /api/places/ingest-apple.
2. /api/places/ingest-apple: upsert into places + place_source_refs
   (source='apple'). Admin-only fallback for manual cleanup.
3. serwist: manifest.json (name "Work in Cafe", short_name "Workin",
   icons 192/512/maskable, theme_color, display standalone, orientation
   portrait). Service worker: stale-while-revalidate for map tiles + APIs.
4. Loading skeletons (map, card, profile) with shimmer.
5. /app/error.tsx + route-level error boundaries.
6. PostHog + Sentry init. Instrument Appendix D events.
7. /app/onboarding (first launch): welcome → location permission →
   geo-verified explainer → optional sign-in. Skip flag in localStorage.
8. Privacy policy + ToS static pages.
9. Verify custom domain, OG image, favicon, robots.txt, sitemap.xml.
10. Monthly re-sync cron (Vercel cron) calling a protected endpoint
    that runs the seed-osm.ts logic in diff mode (insert new, update
    changed, flag missing).

Tag v1.0.0.
```

---

## 18. Appendices

### Appendix A — Schema SQL

*Full schema. Apply in Phase 1.*

```sql
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";
create extension if not exists "pg_trgm";

create type place_category as enum (
  'cafe','bakery','library','coworking','hotel','restaurant','fast_food','other'
);
create type noise_level as enum ('quiet','moderate','loud');
create type seating_availability as enum ('plenty','some','full');
create type temperature_level as enum ('cold','comfortable','warm','hot');
create type place_source as enum ('apple','google','osm','user_submitted');
create type request_status as enum ('pending','approved','rejected');
create type flag_reason as enum ('spam','offensive','untrue','irrelevant','other');

-- Users
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  trust_score real default 10,
  home_city text,
  is_admin boolean default false,
  is_banned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Places
create table public.places (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  city text,
  country text,
  neighborhood text,
  lat double precision not null,
  lng double precision not null,
  geom geography(point, 4326) generated always as
    (st_setsrid(st_makepoint(lng, lat), 4326)::geography) stored,
  category place_category not null default 'other',
  brand text,
  phone text,
  website text,
  hours_json jsonb,
  osm_tags jsonb,
  featured boolean default false,
  normalized_name_hash text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index places_geom_idx on public.places using gist (geom);
create index places_category_idx on public.places (category);
create index places_name_trgm_idx on public.places using gin (name gin_trgm_ops);
create index places_featured_idx on public.places (featured) where featured = true;

create table public.place_source_refs (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid references public.places(id) on delete cascade,
  normalized_name_hash text,
  source place_source not null,
  external_id text not null,
  synced_at timestamptz default now(),
  unique (source, external_id)
);

create table public.place_requests (
  id uuid primary key default uuid_generate_v4(),
  submitted_by uuid not null references public.users(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  category_suggestion place_category,
  notes text,
  status request_status default 'pending',
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz default now()
);

-- Reviews
create table public.reviews (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  overall_rating smallint check (overall_rating between 1 and 5),
  wifi_rating smallint check (wifi_rating between 1 and 5),
  noise_rating smallint check (noise_rating between 1 and 5),
  seating_rating smallint check (seating_rating between 1 and 5),
  comfort_rating smallint check (comfort_rating between 1 and 5),
  outlets_rating smallint check (outlets_rating between 1 and 5),
  price_rating smallint check (price_rating between 1 and 5),
  atmosphere_rating smallint check (atmosphere_rating between 1 and 5),
  food_rating smallint check (food_rating between 1 and 5),
  temperature_rating smallint check (temperature_rating between 1 and 5),
  comment text check (char_length(comment) <= 280),
  geo_verified boolean default false,
  verified_lat double precision,
  verified_lng double precision,
  hour_of_day smallint,
  day_of_week smallint,
  upvotes_count int default 0,
  is_hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index reviews_place_idx on public.reviews (place_id);
create index reviews_user_idx on public.reviews (user_id);
create index reviews_dow_hod_idx on public.reviews (place_id, day_of_week, hour_of_day);

create table public.checkins (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  verified boolean default false,
  studying_until timestamptz,
  hour_of_day smallint,
  day_of_week smallint,
  created_at timestamptz default now()
);

create table public.wifi_tests (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  download_mbps real, upload_mbps real, ping_ms real,
  connection_type text, geo_verified boolean default false,
  created_at timestamptz default now()
);

create table public.decibel_samples (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  avg_db real, peak_db real, duration_seconds int, device_model text,
  hour_of_day smallint, day_of_week smallint,
  created_at timestamptz default now()
);

create table public.favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);

create table public.live_updates (
  id uuid primary key default uuid_generate_v4(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  noise_level noise_level,
  seating_availability seating_availability,
  temperature temperature_level,
  hour_of_day smallint, day_of_week smallint,
  created_at timestamptz default now()
);
create index live_updates_place_time_idx on public.live_updates (place_id, created_at desc);

create table public.flagged_reviews (
  id uuid primary key default uuid_generate_v4(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason flag_reason not null,
  notes text,
  status request_status default 'pending',
  resolved_by uuid references public.users(id),
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz default now()
);

create table public.apple_fill_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  tile_hash text not null,
  created_at timestamptz default now()
);
create index apple_fill_log_idx on public.apple_fill_log (user_id, tile_hash, created_at desc);

create table public.waitlist_partners (
  id uuid primary key default uuid_generate_v4(),
  email text not null, created_at timestamptz default now()
);
create table public.waitlist_business (
  id uuid primary key default uuid_generate_v4(),
  email text not null, place_id uuid references public.places(id),
  created_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.places enable row level security;
alter table public.place_source_refs enable row level security;
alter table public.place_requests enable row level security;
alter table public.reviews enable row level security;
alter table public.checkins enable row level security;
alter table public.wifi_tests enable row level security;
alter table public.decibel_samples enable row level security;
alter table public.favorites enable row level security;
alter table public.live_updates enable row level security;
alter table public.flagged_reviews enable row level security;
alter table public.apple_fill_log enable row level security;
alter table public.waitlist_partners enable row level security;
alter table public.waitlist_business enable row level security;

create policy "users_read_all" on public.users for select using (true);
create policy "users_update_own" on public.users for update using (auth.uid() = id);
create policy "users_insert_self" on public.users for insert with check (auth.uid() = id);

create policy "places_read_all" on public.places for select using (true);
create policy "places_admin_write" on public.places for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

create policy "psr_read_all" on public.place_source_refs for select using (true);
create policy "psr_admin_write" on public.place_source_refs for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

create policy "pr_read_own_or_admin" on public.place_requests for select using (
  submitted_by = auth.uid() or
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);
create policy "pr_insert_own" on public.place_requests for insert with check (submitted_by = auth.uid());
create policy "pr_admin_update" on public.place_requests for update using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

-- Reviews: hide flagged, author and admin can see
create policy "reviews_read_visible" on public.reviews for select using (
  is_hidden = false or auth.uid() = user_id or
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);
create policy "reviews_insert_own" on public.reviews for insert with check (auth.uid() = user_id);
create policy "reviews_update_own" on public.reviews for update using (auth.uid() = user_id);

create policy "checkins_read_all" on public.checkins for select using (true);
create policy "checkins_insert_own" on public.checkins for insert with check (auth.uid() = user_id);

create policy "wifi_read_all" on public.wifi_tests for select using (true);
create policy "wifi_insert_own" on public.wifi_tests for insert with check (auth.uid() = user_id);

create policy "decibel_read_all" on public.decibel_samples for select using (true);
create policy "decibel_insert_own" on public.decibel_samples for insert with check (auth.uid() = user_id);

create policy "favs_rw_own" on public.favorites for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "live_read_all" on public.live_updates for select using (true);
create policy "live_insert_own" on public.live_updates for insert with check (auth.uid() = user_id);

create policy "fr_insert_auth" on public.flagged_reviews for insert with check (auth.uid() = reporter_id);
create policy "fr_admin_all" on public.flagged_reviews for all using (
  exists (select 1 from public.users where id = auth.uid() and is_admin = true)
);

create policy "apple_log_insert_own" on public.apple_fill_log for insert with check (auth.uid() = user_id);
create policy "apple_log_read_own" on public.apple_fill_log for select using (auth.uid() = user_id);

create policy "wl_partners_insert" on public.waitlist_partners for insert with check (true);
create policy "wl_business_insert" on public.waitlist_business for insert with check (true);

-- Triggers
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.set_time_columns()
returns trigger language plpgsql as $$
begin
  new.hour_of_day := extract(hour from new.created_at);
  new.day_of_week := extract(dow from new.created_at);
  return new;
end;
$$;
create trigger reviews_set_time before insert on public.reviews
  for each row execute procedure public.set_time_columns();
create trigger checkins_set_time before insert on public.checkins
  for each row execute procedure public.set_time_columns();
create trigger decibel_set_time before insert on public.decibel_samples
  for each row execute procedure public.set_time_columns();
create trigger live_set_time before insert on public.live_updates
  for each row execute procedure public.set_time_columns();
```

### Appendix B — Materialized views (Phase 3)

```sql
-- Noise heatmap
create materialized view public.mv_noise_heatmap as
with all_noise as (
  select place_id, day_of_week, hour_of_day,
         noise_rating::real as score, 1.0 as weight
  from public.reviews
  where noise_rating is not null
    and created_at > now() - interval '90 days'
    and is_hidden = false
  union all
  select place_id, day_of_week, hour_of_day,
         case noise_level when 'quiet' then 1 when 'moderate' then 3 when 'loud' then 5 end::real,
         0.8
  from public.live_updates
  where noise_level is not null
    and created_at > now() - interval '90 days'
  union all
  select place_id, day_of_week, hour_of_day,
         case when avg_db < 55 then 1 when avg_db < 70 then 3 else 5 end::real,
         0.6
  from public.decibel_samples
  where avg_db is not null
    and created_at > now() - interval '90 days'
)
select place_id, day_of_week, hour_of_day,
       sum(score * weight) / nullif(sum(weight), 0) as noise_score,
       count(*) as sample_count
from all_noise
group by 1, 2, 3;
create unique index on public.mv_noise_heatmap (place_id, day_of_week, hour_of_day);

-- Current live status
create materialized view public.mv_current_live_status as
select distinct on (place_id)
  place_id,
  noise_level as current_noise,
  seating_availability as current_seating,
  temperature as current_temp,
  created_at as last_updated_at
from public.live_updates
where created_at > now() - interval '30 minutes'
order by place_id, created_at desc;
create unique index on public.mv_current_live_status (place_id);

-- Place ratings (implementation sketch; refine in Phase 3)
create materialized view public.mv_place_ratings as
with category_means as (
  select p.category, avg(r.overall_rating)::real as cat_mean
  from public.reviews r
  join public.places p on p.id = r.place_id
  where r.is_hidden = false
  group by p.category
),
weighted_reviews as (
  select
    r.place_id,
    p.category,
    r.overall_rating::real as rating,
    -- Simple weight; full formula per §15 lives in /lib/rating/compute.sql
    least(
      5.0,
      1.0
      + case when r.geo_verified then 0.5 else 0 end
      + 0.3 * coalesce((select 1 from public.wifi_tests w
                        where w.user_id = r.user_id and w.place_id = r.place_id
                        and abs(extract(epoch from w.created_at - r.created_at)) < 600
                        limit 1), 0)
    ) * greatest(0.3, exp(-0.5 * extract(epoch from now() - r.created_at) / (365*86400))) as w
  from public.reviews r
  join public.places p on p.id = r.place_id
  where r.overall_rating is not null and r.is_hidden = false
)
select
  wr.place_id,
  (
    (sum(wr.w * wr.rating) / nullif(sum(wr.w), 0)) * (count(*) / (count(*) + 8.0))
    + cm.cat_mean * (8.0 / (count(*) + 8.0))
  ) as study_spot_rating,
  count(*) as rating_count,
  least(1.0, count(*) / 20.0) as confidence
from weighted_reviews wr
join category_means cm on cm.category = wr.category
group by wr.place_id, cm.cat_mean;
create unique index on public.mv_place_ratings (place_id);
```

### Appendix C — MapKit JS JWT signing (Phase 0)

```ts
// /app/api/mapkit-token/route.ts
import { SignJWT, importPKCS8 } from "jose";
export const runtime = "edge";

export async function GET() {
  const privateKey = await importPKCS8(
    process.env.APPLE_MAPKIT_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    "ES256"
  );
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID!, typ: "JWT" })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(privateKey);
  return Response.json(
    { token },
    { headers: { "cache-control": "private, max-age=1500" } }
  );
}
```

### Appendix D — Analytics events (PostHog, Phase 7)

| Event | Key properties |
|---|---|
| `app_open` | first_session, is_pwa, city_detected |
| `map_moved` | zoom, tile_hash |
| `annotation_tapped` | place_id, category, brand |
| `card_opened` | place_id, rating, review_count |
| `directions_opened` | place_id |
| `review_started` | place_id |
| `review_submitted` | place_id, ratings_count, has_wifi, has_decibel, duration_sec |
| `checkin_submitted` | place_id, verified |
| `live_update_submitted` | place_id, dimensions_updated |
| `filter_applied` | filters_json, result_count |
| `search_executed` | query, result_count, hit_apple |
| `favorite_toggled` | place_id, is_favorite |
| `wifi_test_completed` | place_id, download_mbps |
| `decibel_test_completed` | place_id, avg_db |
| `place_requested` | lat, lng, category_suggestion |
| `review_flagged` | review_id, reason |
| `admin_action_taken` | action, target_type, target_id |
| `signin_completed` | method |
| `waitlist_joined` | list |

### Appendix E — Legal

- **Apple MapKit JS attribution:** "Maps © Apple" in app chrome.
- **OSM attribution (ODbL):** "Place data © OpenStreetMap contributors" footer link to openstreetmap.org/copyright.
- **GDPR (Paris):** privacy policy, cookie banner (analytics), data export endpoint, hard-delete endpoint. Before public Paris launch.
- **Microphone:** button-triggered only. Copy near button: "We process sound locally and never upload audio."
- **UGC license clause** in ToS.

### Appendix F — Overpass query templates

`/scripts/seed-overpass-paris.ql`:
```overpassql
[out:json][timeout:120];
area["name"="Paris"]["admin_level"="6"]->.searchArea;
(
  node["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  node["tourism"="hotel"](area.searchArea);
  way["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  way["tourism"="hotel"](area.searchArea);
);
out body center;
```

`/scripts/seed-overpass-toronto.ql`:
```overpassql
[out:json][timeout:120];
area["name"="Toronto"]["admin_level"="6"]->.searchArea;
(
  node["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  node["tourism"="hotel"](area.searchArea);
  way["amenity"~"^(cafe|bakery|library|fast_food|restaurant|coworking_space)$"](area.searchArea);
  way["tourism"="hotel"](area.searchArea);
);
out body center;
```

---

## 19. Open items
- Logo and brand identity — defer until after Phase 2.
- Kuzog PAAS legal entity — before monetization.
- French i18n — v1.1.
- User photos — v1.1.
- Capacitor native wrap — only if PWA install adoption is weak after 6 months.
- Community moderator program — only after >500 DAU.

---

*End of spec. v3.*
