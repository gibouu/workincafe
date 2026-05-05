# Decisions
One line per decision. Format: [YYYY-MM-DD] area: decision. Why: reason.
[2026-05-05] places-lookup: chain Google → Foursquare → Photon, route detail by placeId prefix (`fsq:`/`osm:`). Why: free Foursquare key already in env covers POIs Photon (OSM) misses.
[2026-05-05] add-place: full-page wizard at `/places/new` instead of vaul drawer. Why: iOS keyboard squashes drawers; native page scroll is the only reliable mobile fix.
[2026-05-05] admin-access: keep `is_admin` flag, add belt-and-suspenders `ADMIN_EMAIL_ALLOWLIST` env (planned in #5). Why: defence-in-depth so a stray `is_admin=true` row can't grant access.
