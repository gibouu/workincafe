# Decision 32 — Cosy seasonal interface, and WorkinCafe in people's AI (MCP)

Status: **proposed** (product owner, 2026-11-12). Becomes ratified when the
technical lead (Cem Gunay) approves the pull request that carries this record;
until then nothing here may be built. Builds on proposed Decision 31.

Reference mock-up: interactive page shared by the product owner on
2026-11-12 (automatic seasons, map-first layout with the café list over the map,
30-second feedback, "Connect your AI").

## Scale

Launch audience is about **10 people** (the founders' freelance friends).
Every choice below stays proportionate to that: no new infrastructure for
scale we do not have, no growth tooling, no analytics.

## 32a — Visual direction: cosy, neutral, seasonal

1. **Neutral warm base**: beige, cream, sand, linen, brown ink. No bright
   orange or red. The festive season (November to early January) shifts the
   accent to **deep garnet, sherry and wine tones** on the same beige base.
2. **The interface changes with the season on its own**, from the date in
   the city's time zone. There is no season picker for users.

   | Theme              | Dates           | Palette and ambient detail                            |
   | ------------------ | --------------- | ----------------------------------------------------- |
   | Autumn             | 22 Sep – 14 Oct | Toasted beige, falling leaves                         |
   | Halloween          | 15 – 31 Oct     | Smoky beige, a few bats                               |
   | Autumn → Christmas | 1 – 30 Nov      | Garnet / sherry / wine, falling leaves, string lights |
   | Christmas          | 1 Dec – 6 Jan   | Wine tones, snow, string lights                       |
   | Winter             | 7 Jan – 19 Mar  | Cool linen, snow                                      |
   | Spring             | 20 Mar – 20 Jun | Sage, petals                                          |
   | Summer             | 21 Jun – 21 Sep | Sand, light motes                                     |

   A theme is a set of colour tokens plus one ambient layer; layout and
   content never change with the season.

3. **Motion** is part of the identity (cards rising in, map pins pulsing,
   sheets sliding up, steam on the logo, a small celebration after a
   review) and always respects `prefers-reduced-motion`.
4. Any animation or font library still goes through the dependency
   allowlist (Decision 26 gate); CSS and canvas come first.

## 32b — Public MCP server: read and write

1. WorkinCafe exposes a **public MCP server** (proposed address
   `https://workin.cafe/mcp`) so people can use it from Claude, ChatGPT,
   Codex or any MCP client. The site shows a **"Connect your AI"** button
   with the address and per-client steps.
2. **Read tools (no account):** find published cafés near a place or
   coordinates, with filters (open now, Wi-Fi, power, quiet, tables); get one café's details, hours, curated
   attributes and community score.
3. **Write tools (signed in, OAuth):** leave the Decision 31c feedback
   (same fields, same mapping, same `community` provenance); suggest a new
   café (becomes a `community` candidate in the review queue); attach a
   photo to a contribution.
4. The MCP answers with **WorkinCafe's own data only**. No Google content
   ever goes out through it (Google-content boundaries, deferred register
   §F).
5. Everything written through the MCP follows the same rules as the site:
   append-only, human review before any publication, never overwrites
   curated values.

## Amends

- **Product scope:** "photos hosted by us" leaves the do-not-build list for
  photos attached to community contributions, shown only after review.
- **Decision 8:** OAuth for MCP clients is added to contributor sign-in.

## Still out of scope

Friends and sessions, drink categories (own decisions); seasonal themes
beyond the six above; listing in MCP directories until the server is stable.
