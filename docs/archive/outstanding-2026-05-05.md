# Outstanding work — archived snapshot (2026-05-05)

> **Archived.** Current work is tracked in **[GitHub Issues](https://github.com/gibouu/workincafe/issues)**, not in this file. Items here were graduated to issues #13–#26 on 2026-05-05.
>
> This file is kept for context — useful when reading old commits or understanding why a piece of work was deferred. Don't add to it. Don't treat it as authoritative.

Original sister docs:
- [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) — what currently exists.
- [`../conventions.md`](../conventions.md) — invariants.
- [`../supabase-auth-setup.md`](../supabase-auth-setup.md) — operator runbook.

## Ideas needing a decision before work starts

_(none currently)_

## Aesthetics / UX

- iPhone-only: validate the place card drawer truly scrolls to the bottom on the smallest viewport heights (single `h-[88dvh]` snap; full profile + reviews are inlined).
- Compact persistent nav for forms (review form, add-place sheet) so users always have a route home without losing draft state. Today only the X button in the header takes them out.
- Place card scroll: confirm that on smallest viewports (iPhone SE) the inlined Reviews section is still reachable.

## Review form

- `next/image` remote loader config for the `review-photos` Storage bucket so photos render through the Next image pipeline. Today the form uses `<img>` directly.
- Automated content moderation for review photos (today: rely on the existing `flagged_reviews` flow as the moderation surface).
- Per-photo edit/replace UX in the slot grid (today: delete + re-add).
- Migrate `LiveUpdateSheet` to the new 1–10 sliders + chip rows (sister surface; kept on the 5-bucket model for now).
- Owner-claim menu attachments (separate from user-submitted photos).
- Sweep `mv_place_ratings` aggregation for the 1–10 cutover if mixing legacy 1–5 and new 1–10 rows ever produces visibly off scores.

## Live update / quick review

- "Live review" chip on the place card opens the LiveUpdateSheet directly. Fillable without auth or geo; submit is gated by 401 → draft + redirect-to-login.
- Inline optional speed-test + sound-test buttons live in the sheet now. Sound test auto-fills the noise question (dB → quiet / moderate / loud).
- Surface "you need to sign in" inline (not just on submit) when no Supabase session is detected — currently the user only finds out after pressing Submit.

## All reviews sheet

- Done: search + sort (newest / top / low / verified). Same on mobile + desktop.
- When photos ship, add a "with photos" filter chip and let users tap into a photo to expand.
- When real reviews land, paginate (currently shows the entire pool of demo reviews per place).

## Schema migration (Phase B SQL)

Most of this landed in `005_review_v2.sql` (rating range widened to 1–10, new collected fields on `reviews`, `review_photos` table). Owner / deals / loyalty / friend-profile schema landed in `006_owners_deals_loyalty.sql` + `007_friend_profiles.sql`. Still outstanding:

- `live_updates.outlets`, `live_updates.rotating_question text`, `live_updates.rotating_answer text` (when `LiveUpdateSheet` is migrated to the new shape).

## Owners / deals / loyalty (PR 2 + 3 to follow)

Foundation shipped in PR 1: schema, claim wizard, admin queue, `/owner` skeleton.
Pending:

- ~~**PR 2** — Deal CRUD on `/owner`, place-card deals section, mocked-payment purchase flow, owner scanner page, `deal_uses` insert → `point_events` server-issued, demo deals seed, loyalty card on profile, freebie redemption picker.~~ Shipped.
- ~~**PR 3** — `/waitlist/partners` becomes the friend-profile wizard, profile Friends tab, drop the Soon badge from the bottom-nav Friends slot.~~ Shipped (Soon badge stays as a hint; drop when matching surface ships).
- ~~**PR 4** — Stripe Connect Express scaffolding.~~ Shipped (data model + lib + onboard + webhook + owner UI). Needs operator to flip on per `docs/stripe-setup.md`.

Deferred (separate plans):

- **Stripe Checkout flow on purchase** — current `/api/deals/[id]/purchase` issues a QR synchronously via the demo path. Switching to real Stripe Checkout requires a `payment_status='pending'` row pre-redirect + a webhook flip to `'paid'` + QR issuance. Schema is ready; UI flow change pending.
- Camera-based QR scanner.
- Magic-link auth for owners without Google/Apple.
- Admin "request more info" workflow on claims.
- Owner email notifications on claim decisions.
- Cron job that expires loyalty points after 12 months.
- Cron job that prunes old `stripe_events` rows.
- Refund initiation UI for owners (Stripe Dashboard works for now).

## Cluster zoom + pin density

- Pin size now scales with zoom (40 → 32 → 28 px at zoom ≥16 / ≥18). Cluster click clamped to +3 zoom levels.
- Open: if pins still overlap at max zoom for same-block places, apply an offset/spread layout (today they sit at the exact same coord and stack invisibly).

## IP-based geolocation

- `/api/geo` returns Vercel-injected lat/lng/city/country. Map page pans to the result if within 80 km of the active city.
- Future: if the IP city matches a known city in `CITIES`, switch the active city automatically. Today we only nudge the map.

## Auth (operator side, not code)

The submit-time auth code path is in place. The remaining work is operator-side and lives in [`./supabase-auth-setup.md`](./supabase-auth-setup.md):

- Enable Google + Apple providers in the Supabase dashboard.
- Add the production + preview redirect URLs to the allow list.
- One end-to-end test of the live review submit flow.

## Filters ↔ collection points

Convention: every filter must have a structured collection point.

- Outdoor seating: collected by the LiveUpdateSheet rotating question (`has_outdoor`). Sufficient for now.
- Bathroom availability: collected by the rotating question. Promote to a dedicated review field if it becomes a popular filter.
- (No `lighting` filter exists in `lib/store/filters.ts` despite the demo data carrying a `lighting` field — leave the data; don't expose a filter without a collection point.)

## Doc maintenance

- Update `ARCHITECTURE.md` whenever a route, store, or surface is added.
- New invariants go in `conventions.md`, not in CLAUDE.md.
- Don't reintroduce per-feature design docs in `docs/` once a feature ships — capture surviving wisdom in `conventions.md` and the architecture index instead.
