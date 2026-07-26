> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: historical data audit of the legacy database; no successor. See `docs/RECONSTRUCTION.md`.

# Place category audit — 2026-05-08

Read-only audit per [issue #79](https://github.com/gibouu/workincafe/issues/79). Feeds the implementation specifics for [#80](https://github.com/gibouu/workincafe/issues/80) (`fast_food` enum split) and [#81](https://github.com/gibouu/workincafe/issues/81) (brand→category overrides).

All numbers from a single snapshot of `public.places`, **2026-05-08**, run through Supabase MCP `execute_sql`. Total: **18,325** seeded places across Paris and Toronto, 458 distinct brands, 7 categories.

## 1. Places per category per city

| Category    | Paris | Toronto |
| ----------- | ----: | ------: |
| restaurant  | 4,770 |   2,860 |
| fast_food   | 1,876 |   2,486 |
| cafe        | 1,866 |   1,484 |
| hotel       | 1,207 |     133 |
| bakery      | 1,126 |     232 |
| library     |   126 |     128 |
| coworking   |    26 |       5 |
| **total**   | 11,997 |  7,328 |

**Reading:**

- **`fast_food` is huge in both cities** — 16% of Paris, 34% of Toronto. Toronto's count almost matches its restaurant count, which is the biggest single signal that the curated default needs the fast_food split (#80) to feel right.
- **Bakeries**: Paris has ~5× Toronto's count. Confirms why the independent-bakery override (#78) matters more in Paris.
- **Coworking is under-seeded** in both cities (26 + 5 = 31). OSM coverage is thin here; consider a future Foursquare/Yelp-driven enrich pass.
- **Hotels**: Paris has ~9× Toronto's count. The Paris seed pulled hotel chains aggressively (Ibis, Mercure, Best Western, etc.); the Toronto seed didn't catch them at the same rate. Worth investigating the OSM `tourism=hotel` density vs the Overpass query, separately from this audit.

## 2. Top 30 brands per city, with assigned category

### Paris

| # | Brand              | Category   |  n |
| - | ------------------ | ---------- | -: |
| 1 | starbucks          | cafe       | 57 |
| 2 | mcdonald's         | fast_food  | 39 |
| 3 | ibis               | hotel      | 36 |
| 4 | subway             | fast_food  | 29 |
| 5 | mercure            | hotel      | 29 |
| 6 | best western       | hotel      | 27 |
| 7 | paul               | bakery     | 26 |
| 8 | amorino            | cafe       | 26 |
| 9 | **pret a manger**  | **fast_food** | **22** |
| 10 | cojean            | fast_food  | 20 |
| 11 | eric kayser       | bakery     | 20 |
| 12 | ibis styles       | hotel      | 19 |
| 13 | brioche dorée     | bakery     | 16 |
| 14 | kfc               | fast_food  | 15 |
| 15 | burger king       | fast_food  | 15 |
| 16 | o'tacos           | fast_food  | 14 |
| 17 | sushi shop        | fast_food  | 14 |
| 18 | pizza hut         | restaurant | 13 |
| 19 | palais des thés   | cafe       | 12 |
| 20 | xing fu tang      | cafe       | 11 |
| 21 | five guys         | fast_food  | 10 |
| 22 | ernest & valentin | bakery     | 10 |
| 23 | pomme de pain     | fast_food  | 10 |
| 24 | le pain quotidien | cafe       | 10 |
| 25 | hippopotamus      | restaurant | 10 |
| 26 | novotel           | hotel      |  9 |
| 27 | indiana café      | restaurant |  9 |
| 28 | exki              | fast_food  |  9 |
| 29 | nespresso         | cafe       |  8 |
| 30 | the coffee        | cafe       |  8 |

**Bold** = miscategorised, see §3.

### Toronto

| # | Brand                  | Category   |   n |
| - | ---------------------- | ---------- | --: |
| 1 | tim hortons            | cafe       | 364 |
| 2 | subway                 | fast_food  | 197 |
| 3 | starbucks              | cafe       | 151 |
| 4 | pizza pizza            | fast_food  |  89 |
| 5 | mcdonald's             | fast_food  |  82 |
| 6 | popeyes                | fast_food  |  60 |
| 7 | a&w                    | fast_food  |  50 |
| 8 | pizza nova             | fast_food  |  48 |
| 9 | domino's               | fast_food  |  45 |
| 10 | kfc                   | fast_food  |  43 |
| 11 | second cup            | cafe       |  42 |
| 12 | booster juice         | fast_food  |  35 |
| 13 | burger king           | fast_food  |  28 |
| 14 | harvey's              | fast_food  |  28 |
| 15 | freshii               | restaurant |  28 |
| 16 | swiss chalet          | restaurant |  28 |
| 17 | mr. sub               | fast_food  |  26 |
| 18 | baskin-robbins        | cafe       |  24 |
| 19 | osmow's               | fast_food  |  24 |
| 20 | real fruit bubble tea | cafe       |  23 |
| 21 | wendy's               | fast_food  |  22 |
| 22 | aroma espresso bar    | cafe       |  22 |
| 23 | thaï express          | fast_food  |  21 |
| 24 | taco bell             | fast_food  |  20 |
| 25 | pizza hut             | restaurant |  19 |
| 26 | coco                  | cafe       |  19 |
| 27 | fat bastard burrito   | fast_food  |  18 |
| 28 | chipotle              | fast_food  |  18 |
| 29 | pizzaville            | fast_food  |  17 |
| 30 | chatime               | cafe       |  16 |

**Reading:**

- Tim Hortons is correctly `cafe` (364 of them in Toronto). The OSM seed handled the dominant Canadian coffee chain right.
- **Pret a Manger Paris is the single biggest miscategorisation** — 22 rows in `fast_food` despite being the canonical "café where I work" chain in #81's spec.
- **Chipotle** sits in `fast_food` (Paris 3, Toronto 18) — explicitly named in #80's spec as the prototype "fast-casual that should move to `restaurant`".
- A few `cafe` assignments are debatable (Amorino is gelato, Baskin-Robbins is ice cream, Real Fruit Bubble Tea / Coco / Chatime are bubble tea) — none of them are "work spots" but they're not actively harmful in the cafés-only default. **Out of scope for #80/#81; revisit only if users complain.**

## 3. Coffee chains miscategorised (Starbucks-as-fast_food problem)

Cross-check: any place whose `lower(brand)` matches a known coffee chain from `lib/brand-logos.ts` but whose `category` ≠ `cafe`.

| City  | Brand          | Current category |  n |
| ----- | -------------- | ---------------- | -: |
| Paris | pret a manger  | fast_food        | 22 |
| Paris | dunkin'        | fast_food        |  3 |

That's it. **Total: 25 rows across both cities.**

The Starbucks-as-fast_food fear in #81 turned out to be specifically a Pret-as-fast_food and Dunkin-as-fast_food situation. Toronto's coffee chains all categorise correctly because OSM tags Tim Hortons / Starbucks / Second Cup with `amenity=cafe` consistently in Canada.

**Recommendation for [#81](https://github.com/gibouu/workincafe/issues/81)**: the SQL backfill is much smaller than the spec assumed. The mapping list in the issue can collapse to the chains we actually find in the data:

```sql
update public.places
set category = 'cafe'
where lower(brand) in (
  'pret a manger', 'pret',
  'dunkin''', 'dunkin'
) and category <> 'cafe';
```

Re-running the audit after this should return zero rows. The issue's broader chain mapping (Costa, Caffè Nero, etc.) is still worth keeping in the script for forward-compatibility — they just don't have rows to fix today.

## 4. `category = 'other'` rows with a known brand

```
select count(*) from public.places where category = 'other';
→ 0
```

**Non-finding.** No 'other' rows exist in the seed. The OSM importer assigns one of the seven enum values to every place, so this corner of the audit is empty. No action needed for #76 — the `'other'` bucket is clean by construction.

## 5. `fast_food` brand distribution → burger vs fast-casual whitelist

This feeds [#80](https://github.com/gibouu/workincafe/issues/80) directly. Filtered to brands with ≥3 rows so the lists are signal, not noise. **94 brands** total above the threshold; below are the proposed buckets.

### Stay `fast_food_burger` (burger / fried-chicken / pizza / sub / dessert / food-court chains)

These are *"nobody opens the app to find them as a work spot"* per the issue spec.

```text
mcdonald's, burger king, subway, kfc, popeyes, a&w, harvey's, wendy's,
five guys, dairy queen, taco bell, mary brown's, chick-fil-a,
hero certified burgers, south street burger, the burger's priest,
shake shack, jollibee, mr. sub, quiznos, firehouse subs, jimmy the greek,
bourbon st. grill, manchu wok, edo japan, teriyaki experience,
thaï express, sushi shop, mac's sushi, chungchun rice dog,
pizza pizza, pizza nova, domino's, pizzaville, 241 pizza, papa john's,
gino's pizza, pizza depot, pizzaiolo, panago, little caesars,
new york fries, krispy kreme, cinnabon, mr. pretzels,
booster juice, jugo juice, freshly squeezed,
basil box, villa madina, ali baba's, wing machine, kernels popcorn,
shanghai 360, church's chicken, fat bastard burrito, osmow's,
o'tacos, pomme de pain, brioche dorée (when fast_food), bagelstein,
la croissanterie, class'croute, novettino, g la dalle,
pita land, ikea, costco, cultures
```

### Move to `restaurant` (fast-casual — Chipotle, Sweetgreen-style, "you'd actually open a laptop here")

```text
chipotle, freshii (already restaurant — no-op), pita pit, exki, cojean,
poke house, pokawa, oakberry açaí bowls, pitaya,
big fernand, côté sushi, chamas tacos,
burrito boyz, mucho burrito, quesada, barburrito,
tahini's, california sandwiches, mac's sushi (debatable)
```

### Move to `cafe` (handled by #81, but also surfaces here as fast_food)

```text
pret a manger (Paris, 22 rows)
dunkin' (Paris, 3 rows)
```

### Borderline / leave decision to a human pass

- **`brioche dorée`** appears in both `bakery` (16) and `fast_food` (3) in Paris — chain straddles bakery/fast-food. Lean `bakery` since the brand identity is bread-first.
- **`paul`** appears in both `bakery` (26) and `fast_food` (6) in Paris. Same call: `bakery`.
- **`la croissanterie`** is exclusively `fast_food` (8 rows) — pastry chain that runs more like fast food. Could go either way.
- **`ikea`**, **`costco`** under `fast_food` (3 + 5 in Toronto) — these are the in-store cafeterias. Defensible as `fast_food` but oddly tagged. Out of scope.

## Implications for #80 / #81

- **#81 (brand→cafe override)** is much smaller than the spec implied — only Pret + Dunkin in Paris (25 rows total). Ship the script anyway; future-proofs against new chains.
- **#80 (fast_food split)** has a clear bucket of ~70+ "burger/fried/pizza" chains and a smaller (~20) bucket of fast-casual. The default for unmatched OSM `amenity=fast_food` rows should be `fast_food_burger` (safer for the cafés-only welcome state).
- **No 'other' rows exist** — the part of #76's umbrella that worried about misclassified 'other' is a non-issue.

## How to re-run

All five queries are safe to re-run via Supabase MCP `execute_sql`. They're read-only `select`s. Re-run after #81's SQL backfill to confirm Section 3 returns zero rows.
