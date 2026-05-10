# Project Memory
Stable facts, conventions, and gotchas. Append-only. One line per entry.
Never write secrets, credentials, internal URLs, or customer data here.

OSM tagging: Tim Hortons / Dunkin' / Krispy Kreme are `amenity=fast_food` not `amenity=cafe`; cafe-only seeds miss them by design — reclassify post-seed via brand allowlist.
Worktree env: `.env.local` is gitignored and lives only in the main checkout (`/Users/gibou/code/github/workincafe/`); symlink it into `.claude/worktrees/<name>/.env.local` to run seed/enrich scripts from a worktree.
Seed pipeline: cities live in `scripts/seed-cities.ts` (bbox + mode). Add new city = one row + run `npx tsx scripts/seed-osm.ts <key>`. No `.ql` files anymore.
