# Decisions
One line per decision. Format: [YYYY-MM-DD] area: decision. Why: reason.
[2026-05-05] places-lookup: chain Google → Foursquare → Photon, route detail by placeId prefix (`fsq:`/`osm:`). Why: free Foursquare key already in env covers POIs Photon (OSM) misses.
[2026-05-05] add-place: full-page wizard at `/places/new` instead of vaul drawer. Why: iOS keyboard squashes drawers; native page scroll is the only reliable mobile fix.
[2026-05-05] admin-access: keep `is_admin` flag, add belt-and-suspenders `ADMIN_EMAIL_ALLOWLIST` env (planned in #5). Why: defence-in-depth so a stray `is_admin=true` row can't grant access.
[2026-05-07] forms-drafts: persist add-place + review form state to localStorage instead of adding a separate "save & exit" nav button. Why: existing X already routes home; auto-save makes it lossless without new UI surface (issue #14 acceptance).
[2026-05-07] place-card: switch from fixed `h-[88dvh]` to vaul snap points `[0.55, 0.95]` (default 0.55). Why: iPhone SE (568pt) couldn't reach inlined Reviews; snap points give pull-up to ~95dvh without breaking desktop (FloatingPlaceCard renders ≥768px).
[2026-05-07] places-lookup: when FSQ search returns a Shopping Mall / Department Store hit, follow up with one Place Details call (cap 2 malls/query, 8 children/mall) to inline `related_places.children` as predictions. Why: mall-internal chains (Starbucks Beaugrenelle) don't surface as top-level FSQ hits; inline crawl fixes the live-search path without new UI.
[2026-05-07] review-photos: `next/image` with `remotePatterns` for `res.cloudinary.com`, no transform path — let Vercel's optimizer + Cloudinary's `f_auto/q_auto` defaults handle responsive delivery. Why: avoid double-optimizing or maintaining a custom Cloudinary loader for MVP.
[2026-05-07] map-pins: at zoom ≥18, displace colocated points in a 5m ring around the original centre via a hand-rolled helper (no turf). Why: 5m latitude-scaled offset doesn't justify pulling ~250kB of geodesy.
