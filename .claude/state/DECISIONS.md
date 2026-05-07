# Decisions
One line per decision. Format: [YYYY-MM-DD] area: decision. Why: reason.
[2026-05-05] places-lookup: chain Google → Foursquare → Photon, route detail by placeId prefix (`fsq:`/`osm:`). Why: free Foursquare key already in env covers POIs Photon (OSM) misses.
[2026-05-05] add-place: full-page wizard at `/places/new` instead of vaul drawer. Why: iOS keyboard squashes drawers; native page scroll is the only reliable mobile fix.
[2026-05-05] admin-access: keep `is_admin` flag, add belt-and-suspenders `ADMIN_EMAIL_ALLOWLIST` env (planned in #5). Why: defence-in-depth so a stray `is_admin=true` row can't grant access.
[2026-05-07] forms-drafts: persist add-place + review form state to localStorage instead of adding a separate "save & exit" nav button. Why: existing X already routes home; auto-save makes it lossless without new UI surface (issue #14 acceptance).
[2026-05-07] place-card: switch from fixed `h-[88dvh]` to vaul snap points `[0.55, 0.95]` (default 0.55). Why: iPhone SE (568pt) couldn't reach inlined Reviews; snap points give pull-up to ~95dvh without breaking desktop (FloatingPlaceCard renders ≥768px).
