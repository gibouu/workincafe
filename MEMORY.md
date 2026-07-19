> Before making changes in this repository, read this entire file, then read `AGENTS.md` and the current open GitHub issues. Verify all statements against the current repository and GitHub state because this document is a handoff record, not an infallible source of truth.

# WorkinCafe project memory

## Project purpose

WorkinCafe is a map-first product for people looking for cafés, bakeries, libraries, coworking spaces, hotel lobbies, and restaurants suitable for working or studying. The production web product serves Paris, Toronto, London, New York, Tokyo, and Seoul. Paris and Toronto have the broadest category coverage; the other cities focus on cafés, libraries, and coworking.

Primary journeys are discovering work spots on a map or list, searching/filtering loaded places, inspecting place details and work suitability, getting directions, and—after the required API/auth work—saving places, contributing reviews/live measurements, managing a profile, and adding places.

Current priorities are:

1. Preserve and finish verification of the polished native SwiftUI representative slice.
2. Complete measured web/shared performance work.
3. Establish versioned consumer APIs and secure native authentication.
4. Implement authenticated/device-integrated native flows.
5. Close privacy, security, accessibility, operational, TestFlight, and App Store gates.

## Current repository state

- Repository: `gibouu/workincafe` (`https://github.com/gibouu/workincafe.git`).
- Default branch: `main`.
- Stable default-branch commit at this handoff: `cf66a5c7a859b6153aeeeca1ec509dd85a618f21` (`feat: add native iPhone discovery MVP`, PR #307).
- Active native rebuild branch: `feat/310-native-product-rebuild`, published on `origin` with draft PR [#313](https://github.com/gibouu/workincafe/pull/313).
- Native source-state commit documented here: `a8fd2e9a7cff34b7c32344f071bc5e22f7bca51d` (`Keep detail canonical during refresh`). The documentation commit containing this file is newer; use `git log -1` for its SHA.
- Active web-performance branch: `feat/300-web-performance-cleanup` at `3310309a44fa3cfc41954ea6c87749d304bd8e18`, published on `origin` with draft PR [#314](https://github.com/gibouu/workincafe/pull/314).
- Preservation publication record: neither active branch existed on `origin` before this pass. Both exact audited tips were pushed without force and the draft PRs above were opened; verify remote refs before relying on this snapshot.
- Remote publication and PR state can change after this file is committed; verify with `git ls-remote`, `gh pr list`, and onboarding issue [#311](https://github.com/gibouu/workincafe/issues/311).
- The native branch implements Tasks 1–6 of the representative-slice plan, but Task 6 is not complete because post-`a8fd2e9` Simulator verification and cumulative independent review remain mandatory.
- Relevant live worktrees at audit time: main, `feat/300-web-performance-cleanup`, `feat/302-native-ios-shell-map`, and `feat/310-native-product-rebuild`. Historical missing/prunable registrations and stashes are protected by [#312](https://github.com/gibouu/workincafe/issues/312).
- Open PRs after publication: Dependabot [#295](https://github.com/gibouu/workincafe/pull/295) (core checks green but branch behind), Dependabot [#297](https://github.com/gibouu/workincafe/pull/297) (CI `verify` and Vercel failed), native draft [#313](https://github.com/gibouu/workincafe/pull/313), and web-performance draft [#314](https://github.com/gibouu/workincafe/pull/314). None was merged by the preservation pass.
- Web production is `https://workin.cafe` / `https://www.workin.cafe`, deployed through Vercel with Supabase/PostGIS services.
- Native release state: no approved release candidate, TestFlight build, App Store archive/upload, or production release. Do not archive or submit the current representative slice.

## Architecture

### Frontend

- Web: Next.js 16 App Router, React 19, TypeScript, MapLibre GL JS with OpenFreeMap tiles, Zustand, `vaul`, Tailwind/PostCSS, and Phosphor icons.
- Demo mode uses checked-in place data and works without Supabase. Live routes use Supabase while retaining graceful demo behavior when tables or environment configuration are absent.
- Category visuals are centralized in `lib/categories.ts`; known chain visuals are centralized in `lib/brand-logos.ts`.

### Backend, database, and APIs

- Next.js route handlers under `app/api/**` are the web/API host.
- Supabase/Postgres/PostGIS is the shared source of truth. Supabase browser/server/admin clients live under `lib/supabase/`.
- Existing native public discovery calls `/api/places?bbox=…` and consumes summary data only.
- The versioned consumer contract, bearer-auth parity, universal links, full detail/review/menu reads, and authenticated writes remain issue [#301](https://github.com/gibouu/workincafe/issues/301).
- Repository policy requires future database access through `scripts/db` with `docs/DATABASE_ACCESS.md`; these are not implemented yet and are explicitly part of [#304](https://github.com/gibouu/workincafe/issues/304). Do not improvise direct agent database access.

### Authentication and storage

- Web auth uses Supabase sessions with Google and Apple OAuth; owner-only magic-link entry remains intentionally scoped.
- Native Keychain sessions and bearer-token authentication are not implemented in the representative slice.
- Cloudinary is used for supported web photo workflows. Public native photo/review behavior remains behind later moderation and release gates.

### Native application

- Swift 6 / SwiftUI, iOS 18+, iPhone-only.
- `MKMapView` is hosted in SwiftUI for annotation reuse, clustering, stable diffs, camera control, and accessibility.
- `AppEnvironment` injects live or deterministic fixture API/cache dependencies.
- `MapFeatureModel` owns cache-first loading, request generations, cancellation, deduplication, and current/cached publication.
- `DiscoveryStore` owns map/list mode, local search/filter matching, camera intent, and retained selected-place identity.
- `AppRouter` and `NavigationStack` own native navigation; previews are sheets and full place details are navigated views.

### Infrastructure and important directories

- `.github/workflows/ci.yml`: current GitHub CI for the web app; native macOS CI is not yet present.
- `app/`, `components/`, `lib/`: web application and API code.
- `supabase/migrations/`: database migrations; use the documented policy before any database action.
- `ios/WorkInCafe/`: native source.
- `ios/WorkInCafeTests/`, `ios/WorkInCafeUITests/`: native unit and UI tests.
- `ios/project.yml`: XcodeGen source; `ios/WorkInCafe.xcodeproj` is generated but intentionally tracked.
- `docs/superpowers/`: approved plans/specifications.
- `.artifacts/` and `.superpowers/sdd/`: ignored local evidence; never assume another clone has them.

### Important commands

```bash
# Web
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build

# Native
scripts/ios-generate
scripts/ios-generate --check
scripts/ios-test
scripts/ios-test --only WorkInCafeTests/MapFeatureModelTests
scripts/ios-test --ui-only WorkInCafeUITests/PlaceFlowTests
scripts/ios-companion
scripts/ios-companion --check

# Repository orientation
git status --short --branch
git worktree list --porcelain
git stash list
gh issue list --state open
gh pr list --state open
```

## Completed work

### Native MVP foundation on `main`

- Design/plan: PRs #299 and #306.
- Reusable native MVP: PR #307 / commit `cf66a5c`; issue #302 is closed.
- Delivered Xcode project generation, SwiftUI shell, MapKit bridge, public place API client, cache-first model, clustering, basic search, and test infrastructure.
- Limitation: this was explicitly a technical MVP, not an approved App Store UI.

### Approved polished representative-slice design and plan

- Commits `4ce337d` and `fdd092f`.
- Main files: `docs/superpowers/specs/2026-07-19-native-workincafe-product-rebuild-design.md` and `docs/superpowers/plans/2026-07-19-native-representative-slice.md`.
- Decision: the web product is the brand/information reference; native iOS interaction patterns own navigation, sheets, safe areas, accessibility, and gestures.

### Task 1 — place identity and design system

- Commit `0ad30aa`.
- Added shared native color/spacing/type/category presentation, branded/category identity badges, and work-rating presentation.

### Task 2 — product shell and deterministic fixtures

- Commit `bb6630f`.
- Added root product composition, router, product dock, Work spots ownership, and deterministic fixture environment.

### Task 3 — resilient discovery state and requests

- Commits `7bb44a3`, `4f8d4ed`, and `2c6b6a5`.
- Added cache-first/current generation behavior, safe bounds/request decisions, cancellation, duplicate-ID handling, stale-result protection, and focused tests.

### Task 4 — branded native map/list discovery

- Commits `993d0a6` and `761f656`.
- Added custom MapKit markers/clusters, synchronized map/list selection, compact native discovery chrome, honest unavailable states, Reduce Motion behavior, and accessibility identifiers.

### Task 5 — native search and honest filters

- Commits `c02f95e`, `a0ae11b`, `bd3b731`, and `2201e69`; checkpoint `e8005a8`.
- Added local/cached search, backed category/rating filters, off-main matching/count work, cancellation/generation guards, result-count copy, and deterministic UI coverage.
- Issue #308 was closed with 31 focused passing tests.

### Task 6 — selected preview and navigated detail, implemented but awaiting final gate

- Initial implementation: `98b3529`.
- Review repairs: `f2a03b3`, `f914b05`, and `a8fd2e9`.
- Main files: `DiscoveryStore.swift`, `DiscoveryScreen.swift`, `MapAnnotations.swift`, `PlacePreviewSheet.swift`, `PlaceDetailView.swift`, `AppRootView.swift`, and their unit/UI tests.
- Implemented 44-point marker/cluster targets without changing visible/collision geometry; retained stable selection across transient omissions; canonical same-ID refresh for preview and already-open detail; Dynamic Type reflow; honest disabled Save; Apple Maps walking directions; canonical singular share URL; and antimeridian model regression coverage.
- Known limitation: the strengthened post-`a8fd2e9` refresh UI test has not produced GREEN because CoreSimulator failed before XCTest. Do not mark this milestone complete yet.
- Publication: draft PR [#313](https://github.com/gibouu/workincafe/pull/313); it intentionally remains unmerged pending the mandatory gate and cumulative review.

### Web performance Task 1, completed with concerns

- Branch `feat/300-web-performance-cleanup`; commits `b3073e7` and `3310309`.
- Added reproducible route-bundle parsing, regression budgets, CLI checks, CI wiring, and focused tests.
- Fresh preservation verification measured 8,284,683 bytes uncompressed and 1,907,510 bytes gzip, respectively 171 and 191 bytes smaller than the checked-in baseline; all focused/full web gates listed below passed.
- Publication: draft PR [#314](https://github.com/gibouu/workincafe/pull/314); it intentionally remains unmerged until the baseline/budget review is accepted.

## Decisions and rationale

- **Established:** build a fully native SwiftUI/MapKit app, not a web wrapper.
- **Established:** use the production web product as the brand, terminology, hierarchy, content-density, and behavior reference while preferring stronger native interaction patterns.
- **Established:** never invent unsupported place details, measurements, availability, review counts, or success states.
- **Established:** search/filter currently operate on loaded/cached viewport summaries; do not imply server-global search.
- **Established:** stable place ID owns selection and route continuity. Ordinary refresh omission does not clear selection; explicit dismissal, replacement, search-context reset, or confirmed invalidation may clear it.
- **Established:** normal preview starts at `.medium`; accessibility sizes start at `.large`; the 310-point detent remains available at normal sizes.
- **Established:** canonical share links use `https://www.workin.cafe/place/{id}`.
- **Established:** map marker artwork remains 32/42 points and cluster artwork 34/40/46 points; centered interaction/accessibility targets are at least 44×44 without changing collision geometry.
- **Established security boundary:** ordinary native requests must never use a service-role client; authorization and RLS remain authoritative.
- **Established privacy boundary:** foreground location only; do not persist exact location unnecessarily; never store/upload raw microphone audio.
- **Established release boundary:** no RC, TestFlight, archive/export/upload, App Store submission, or production release until #304/#305 and all native visual/test gates pass.
- **Rejected:** preserving generic MVP visuals merely because they already existed.
- **Rejected:** clearing selection when one viewport result omits the selected place.
- **Rejected:** hiding unsupported fields behind fabricated placeholders or fake successful controls.
- **Assumption to re-verify:** current external web/API behavior and App Store requirements can change; verify live production and current Apple requirements before implementation or release.

## Verification status

### Passing evidence

- Tasks 1–5 have focused/full local verification and independent review recorded in ignored `.superpowers/sdd/` reports. Task 5's final ledger reports 62 unit tests plus 2 UI tests, XcodeGen verification, unsigned simulator build, and clean diff.
- Task 6 before the final detail-lifecycle test: `scripts/ios-test` passed 70 Swift Testing tests and 5 UI tests (75 total) in `.artifacts/ios-tests/WorkInCafe-20260719-192020.xcresult`.
- Focused Task 6 repair evidence passed for marker geometry, selection lifetime/reordering, normal UI, accessibility XXXL layout/order, controlled omission/reappearance, canonical share URL, and eastbound/westbound/cached-failure antimeridian behavior.
- Light, dark, accessibility, and map screenshots were inspected locally under `.artifacts/task-6-repair/`.
- After `a8fd2e9`, `scripts/ios-generate --check` and `git diff --check` passed; a generic unsigned device compile excluding only `Assets.xcassets` passed because asset tooling itself queried the failed Simulator runtime.

### Genuine product RED and implemented fix

- `.artifacts/ios-tests/WorkInCafe-20260719-193101.xcresult` proved that an already-open detail initially retained a captured old `PlaceSummary` and did not render the canonical same-ID refresh.
- `a8fd2e9` introduced an observed stable-ID detail destination that resolves through `DiscoveryStore` on publication.
- This fix compiles, but no post-fix Simulator GREEN exists yet.

### Blocked mandatory verification

The required final gate is:

```bash
scripts/ios-test --ui-only WorkInCafeUITests/PlaceFlowTests/testPreviewSurvivesOmissionAndRefreshesOnSameIDReappearance
# run the same strengthened UI test a second consecutive time
scripts/ios-test
scripts/ios-generate --check
xcodebuild -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -destination '<clean existing iPhone simulator>' clean build-for-testing CODE_SIGNING_ALLOWED=NO
git diff --check origin/main...HEAD
git status --short --branch
```

CoreSimulator failure boundary:

1. `com.apple.CoreSimulator.simdiskimaged` became wedged and CoreSimulator failed before XCTest.
2. A user-approved administrator `launchctl kickstart -k system/com.apple.CoreSimulator.simdiskimaged` restart initially produced a healthy new daemon and one successful `simctl list`.
3. The very next attempt to shut down the existing simulator failed with:

```text
CoreSimulatorService connection became invalid.
Could not kickstart simdiskimaged.
simdiskimaged crashed or is not responding.
Failed to initialize simulator device set.
Error Domain=NSPOSIXErrorDomain Code=61 "Connection refused"
```

4. Work stopped immediately. No simulator was erased/recreated, no DerivedData was reset, and no reboot was attempted.

Next safe recovery is a host reboot approved/performed by the user, followed by the exact final gate above. If a reboot does not restore the service, stop and report before erasing/recreating devices or performing more invasive recovery.

### Web/CI/PR status

- Current GitHub CI covers web install, lint, typecheck, tests, and build on Ubuntu. Native/macOS CI is absent.
- Web-performance preservation verification on `3310309`: `npm ci`; 10/10 focused bundle tests; lint; typecheck; production build; bundle report; bundle check; range diff check; and clean status all passed. The build emitted one non-fatal edge-runtime/static-generation warning.
- Open PR #295 had core checks green but was behind `main`; no preservation merge was performed.
- Open PR #297 had failed `verify` and Vercel status; it must not be merged until corrected and reverified.
- Draft PR #313 is the published native handoff and remains blocked on the Task 6 final gate. Draft PR #314 is the published web-performance Task 1 slice and remains scoped to #300.
- No Task 6, TestFlight, or App Store success should be inferred from prior artifacts.

## Known issues and unfinished work

### Finish and independently review Task 6 — #309 and #310

- **Status:** implemented, verification-blocked.
- **Why it matters:** selection/detail continuity, accessibility, marker targets, and antimeridian behavior are release-critical foundations.
- **Evidence/files:** commits `f2a03b3`, `f914b05`, `a8fd2e9`; `PlaceFlowTests.swift`; `MapFeatureModelTests.swift`; local Task 6 report/artifacts.
- **Dependencies:** healthy CoreSimulator and fresh cumulative independent review.
- **Next action:** reboot host, run the mandatory gate, create the cumulative review package from `0275a4a` through HEAD, resolve every Critical/Important finding, update Task 6 checkboxes/ledger, then close #309 only if all acceptance criteria are evidenced.

### Complete representative-slice Task 7 and final Task 8 — #310

- **Status:** not started.
- **Why it matters:** the native/browser comparison companion and approved 320/393/430-point visual matrix are still required before the representative slice is accepted.
- **Evidence/files:** unchecked Tasks 7–8 in `docs/superpowers/plans/2026-07-19-native-representative-slice.md`; companion currently lacks the planned representative-slice revision/decision record.
- **Dependencies:** Task 6 acceptance first.
- **Next action:** only after explicit Task 6 approval, implement the tracked companion decision/evidence files and final independent review/visual approval.

### Finish measured web performance program — #300

- **Status:** Task 1 implemented with concerns; Tasks 2–8 pending.
- **Why it matters:** bundle, responsive rendering, data loading, and map/list efficiency are shared launch foundations.
- **Evidence/files:** `feat/300-web-performance-cleanup`, commits `b3073e7` and `3310309`, `docs/superpowers/plans/2026-07-15-web-performance-cleanup.md`.
- **Dependencies:** review the baseline variance; preserve branch/PR evidence.
- **Next action:** review Task 1, then continue the plan sequentially with measured baselines.

### Consumer API and native authentication — #301

- **Status:** not implemented.
- **Why it matters:** authenticated native favorites, reviews, profile, and contributions must not bypass cookie/bearer parity or RLS.
- **Dependencies:** measured shared data boundary from #300.
- **Next action:** implement the OpenAPI contract and authorization parity before authenticated native surfaces.

### Authenticated and device-integrated native flows — #303

- **Status:** not implemented.
- **Why it matters:** iOS v1 still lacks native auth, Keychain, favorites, contributions, location/camera/photo/Wi-Fi/audio flows, and recovery behavior.
- **Dependencies:** #301 and accepted native shell/product foundations.
- **Next action:** execute the approved device-flows plan only after API contracts exist.

### Release safety and App Store delivery — #304 and #305

- **Status:** not ready; release blocked.
- **Why it matters:** privacy manifests, legal/account lifecycle, moderation, accessibility/device matrices, observability, signing, TestFlight, App Store metadata, and monitored rollout remain open.
- **Dependencies:** #300, #301, #303, #309, #310 and human credentials/approvals.
- **Next action:** complete #304 before any external TestFlight gate; begin #305 packaging/submission only after #304 approval.

### Historical local Git preservation — #312

- **Status:** open, high priority before cleanup.
- **Why it matters:** local branches, stashes, missing worktree indices, unreachable WIP objects, and ignored Task 6 evidence can be permanently lost.
- **Evidence:** 67 local branches with commits absent from remote refs; 11 stashes; 44 missing/prunable worktree registrations; local ignored artifacts.
- **Dependencies:** original machine access and human disposition of ambiguous ownership/sensitivity.
- **Next action:** follow #312 acceptance criteria before pruning, branch deletion, stash deletion, reflog expiry, `git clean -x`, worktree removal, or GC.

### Dependency PRs — #295 and #297

- **Status:** open, unmerged.
- **Why it matters:** #295 is behind and needs current compatibility review; #297 has failed CI/Vercel evidence.
- **Next action:** update/reverify each independently. Do not merge them as part of native handoff.

### Existing product and operational backlog

These issues remain open and are not superseded by the native rebuild. Their GitHub bodies are the authoritative detailed evidence, affected-file inventory, and acceptance criteria; re-verify each against current code before implementation.

| Issue | Status and why it matters | Evidence / likely files | Dependencies and next action |
| --- | --- | --- | --- |
| [#19](https://github.com/gibouu/workincafe/issues/19) — real Stripe Checkout and owner refunds | Open; purchases still use a synchronous demo path and refunds require the Stripe dashboard. | Purchase/refund API routes, deal confirmation UI, `deal_purchases`. | Requires Stripe configuration and payment/webhook design; implement atomically with tests before any paid launch. |
| [#20](https://github.com/gibouu/workincafe/issues/20) — owner camera QR scanner | Open; owner redemption is manual-only. | `/owner/places/[id]/scan`, existing deal-use API. | Depends on camera permission UX and current redemption contract; retain manual fallback. |
| [#39](https://github.com/gibouu/workincafe/issues/39) — Foursquare detail caching | Open but intentionally deferred; premature without quota/latency evidence. | Foursquare lookup helpers and place-creation lookup route. | Revisit only when issue thresholds are observed; measure before selecting Vercel Runtime Cache/KV. |
| [#40](https://github.com/gibouu/workincafe/issues/40) — pre-publish review-photo moderation | Open; public uploads can currently rely only on post-publication flagging. | Cloudinary signing/webhook routes, `ReviewPhotos`, `review_photos` migration. | Requires paid-provider/cost decision and is a release-safety dependency of public contribution flows; implement before exposing them broadly. |
| [#43](https://github.com/gibouu/workincafe/issues/43) — review pagination | Open but data-density deferred; the all-reviews sheet does not paginate beyond its supplied set. | Place reviews API, `AllReviewsSheet`, `PlaceCardBody`. | Revisit when a place exceeds 20 reviews or product requests paged UX; add stable cursor tests. |
| [#57](https://github.com/gibouu/workincafe/issues/57) — preview environment/protection | Open operational decision; unauthenticated preview access is protected and Preview-scoped variables require human Vercel configuration. | Vercel project settings and middleware behavior from PR #55. | Human must configure Preview scope and choose protection policy; verify a current preview afterward without publishing secret values. |
| [#60](https://github.com/gibouu/workincafe/issues/60) — menu OCR and price history | Open product program; no OCR/versioned price pipeline exists. | Menu upload/storage, new menu item/version tables, menu sheet. | Requires provider/trust/currency decisions and #40-style moderation/privacy review; execute in documented phases. |
| [#83](https://github.com/gibouu/workincafe/issues/83) — quality-based place de-prioritisation | Open and intentionally data-blocked; thresholds cannot be chosen responsibly yet. | Review aggregates and default place selection/ranking. | Revisit after meaningful review density (issue suggests at least five reviews per place); derive thresholds from real evidence. |
| [#169](https://github.com/gibouu/workincafe/issues/169) — AI work-suitability scoring | Open concept; no score pipeline, schema, or UI is implemented. | Future migration, batch script, place card/filter presentation. | Requires data/provider/cost/privacy evaluation and must not fabricate confidence; scope separately after core launch foundations. |
| [#228](https://github.com/gibouu/workincafe/issues/228), [#229](https://github.com/gibouu/workincafe/issues/229), [#230](https://github.com/gibouu/workincafe/issues/230) — medium audit findings 076–154 | Open audit backlog covering validation, authorization, atomicity, error handling, geofencing, upload scope, data correctness, and accessibility. These may contain release/security risks. | Each issue enumerates its local `audit-issues/` draft names and affected application workflows. | Triage each finding into a dedicated fix/duplicate, prioritize security/data-integrity items before release, preserve its detailed acceptance criteria, and run relevant regression/full gates. |
| [#231](https://github.com/gibouu/workincafe/issues/231), [#232](https://github.com/gibouu/workincafe/issues/232), [#233](https://github.com/gibouu/workincafe/issues/233) — low audit findings 155–234 | Open audit backlog covering validation, error exposure, test gaps, stale docs/types, state correctness, and integration edge cases. | Each issue enumerates its local `audit-issues/` draft names and affected application workflows. | Triage after medium/security findings unless a specific item blocks current work; split or deduplicate and add regression coverage before closing. |

No open issue in this table was implemented, closed, or reprioritized by the preservation pass. The open-issue inventory must be re-read at the start of future work because labels and status can change independently of this file.

## Operational knowledge

### Required environment variable names

Never put values in this file or issue/PR logs.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAP_STYLE_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
GOOGLE_PLACES_API_KEY
FOURSQUARE_API_KEY
YELP_API_KEY
PHOTON_ENDPOINT
OVERPASS_ENDPOINT
ADMIN_EMAIL_ALLOWLIST
RESEND_API_KEY
EMAIL_FROM
CRON_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
DEMO_AUTH_ENABLED
DEMO_AUTH_SECRET
DEMO_AUTH_EMAIL
DEMO_AUTH_NAME
NODE_ENV
VERCEL_URL
WORKINCAFE_API_BASE_URL
```

Plan/operator-only names include `APPLE_TEAM_ID`, `VERCEL_ENV`, `WORKINCAFE_DEMO_MODE`, `WIC_ASC_KEY_ID`, `WIC_ASC_ISSUER_ID`, `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`, and `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`.

### Required services

- Node/npm and the versions compatible with `package-lock.json`.
- Vercel for web deployment and cron scheduling.
- Supabase/Postgres/PostGIS for live data/auth.
- OpenFreeMap/MapLibre for the web map; Apple MapKit for native.
- Xcode 26/XcodeGen-compatible tooling and an iOS Simulator/physical device for native verification.
- Cloudinary/Stripe/Resend/Foursquare/Yelp/Google Places only for their configured optional or production flows.

### Safe local setup

1. Read this file, `AGENTS.md`, and the selected issue.
2. Run `git status --short --branch`, inspect worktrees/stashes, and do not clean another contributor's state.
3. Use a scoped branch/worktree.
4. Run `npm install`; demo web mode needs no `.env.local`.
5. Generate/check the native Xcode project with `scripts/ios-generate --check` before native testing.
6. Never access the database except through the repository's required `scripts/db` entrypoint after #304 provides it.

### Generated/sensitive state that must not be committed

- `.env*`, tokens, passwords, private keys, `*.pem`, `*.p8`, certificates, provisioning profiles, session cookies, reviewer credentials, and personal/customer data.
- `~/.config/appstoreconnect-cli/accounts.ini` and all central credential-store values.
- `.artifacts/`, `.xcresult`, DerivedData, archives, IPA files, screenshots unless explicitly approved/tracked, `.next/`, `node_modules/`, `.vercel/`, backups, logs, and Xcode `xcuserdata`.
- `.superpowers/sdd/` is ignored local execution evidence; transfer durable conclusions into tracked docs/issues before deleting a worktree.

### Known environmental failure modes

- CoreSimulator may fail because `simdiskimaged` is wedged. A targeted daemon restart was insufficient in this handoff; reboot before considering invasive simulator recovery.
- `next build` can take minutes. Run lint/typecheck/focused tests first, but do not skip a required production build.
- API routes intentionally preserve graceful demo behavior when live database configuration/tables are absent.
- Xcode project source membership is generated from `ios/project.yml`; do not hand-maintain divergent project changes.

## External dependencies and blockers

- **Apple tooling:** healthy CoreSimulator or physical devices; Xcode/SDK compatibility; signing team; App Store Connect roles/keys; TestFlight human testers; Apple review.
- **GitHub:** branch protection, CI, CodeQL, review, and PR decisions. Never bypass required checks.
- **Vercel:** production/preview configuration, deployment health, cron, and rollback evidence.
- **Supabase:** migrations, RLS, auth providers, database availability, and canonical external credential store.
- **Third parties:** OpenFreeMap, Cloudinary, Stripe, Resend, Foursquare, Yelp, Google Places/Photon, legal/privacy processors.
- **Human approvals:** visual acceptance, ambiguous Git-history disposition, physical-device matrices, moderation/privacy/legal sign-off, release owner, signing credentials, and App Store release decisions.

## Recommended continuation order

1. Read [#311](https://github.com/gibouu/workincafe/issues/311), verify this document against GitHub/current refs, and confirm both active branch refs plus draft PRs [#313](https://github.com/gibouu/workincafe/pull/313) and [#314](https://github.com/gibouu/workincafe/pull/314) resolve. If not, restore the preservation record before product work.
2. Reboot the host, restore CoreSimulator, and finish the post-`a8fd2e9` Task 6 verification twice/full suite/build-for-testing.
3. Complete the cumulative independent Task 6 review, resolve findings, update the plan/ledger, and close #309 only with evidence.
4. Obtain explicit approval before starting Task 7; finish Tasks 7–8 under #310.
5. Review the published web-performance Task 1 draft, then continue #300.
6. Implement #301 before any authenticated native work.
7. Implement #303 after the API/auth contract is accepted.
8. Close #304 release-safety gates before external TestFlight.
9. Execute #305 only after #304 approval.
10. Keep #312 open until historical local Git state has explicit, safe dispositions.
11. Close #298 only after all child workstreams are genuinely complete.

## Last updated

- UTC: 2026-07-19T18:16:02Z
- Branch: `feat/310-native-product-rebuild`
- Source-state commit SHA: `a8fd2e9a7cff34b7c32344f071bc5e22f7bca51d`
- Authoring environment: Codex desktop preservation/handoff pass with read-only subagent inventories and GitHub CLI verification.
