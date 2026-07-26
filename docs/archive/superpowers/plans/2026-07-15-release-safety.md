> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: native iOS program paused; see docs/decisions/source/01-reconstruction.md and the deferred register; branch state preserved in git. See `docs/RECONSTRUCTION.md`.

# Release Safety and External TestFlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the database, privacy, moderation, security, observability, accessibility, and physical-device gaps required before external TestFlight.

**Architecture:** Release safety is enforced in code and CI rather than a final manual scramble. Database replay and RLS smoke tests run through the sole `scripts/db` gateway; production config fails closed; public photos remain behind a default-off multi-layer gate until moderation/blocking/deletion works; web/native telemetry is privacy-redacted; and one release checklist aggregates automated CI plus signed physical-device/manual evidence.

**Tech Stack:** Node 22, Next.js 16.2.9, Supabase/Postgres, Sentry Next.js 10.65.0, GitHub Actions, Playwright 1.61.1, axe-core Playwright 4.12.1, Xcode 26, macOS 26 runner, XCTest/XCUITest, MetricKit, OSLog.

## Global Constraints

- Tracking issue: [#304](https://github.com/gibouu/workincafe/issues/304); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- Hard dependencies: issues #300–#303 are feature-complete and merged before external TestFlight opens.
- Every database action goes through `scripts/db`; reads require no flag, writes require `--write`, and destructive/reset actions require `--write --force`.
- Public review photos stay disabled on missing config, database error, moderation backlog failure, or rollback; hiding a row is not accepted as Cloudinary deletion proof.
- Native v1 uses MetricKit/Organizer/OSLog and no third-party native analytics SDK.
- Legal/controller facts are approved by the repository owner or counsel before legal-copy merge; implementation does not invent a legal name, address, jurisdiction, or transfer basis.
- External TestFlight has zero open P0/P1 defects and no security alert without owner, rationale, and expiry.
- Every commit and PR body ends with `— gib` and contains no AI trailer.

---

## File map

- Database: `scripts/db`, `docs/DATABASE_ACCESS.md`, `supabase/config.toml`, `supabase/migrations/`, `types/database.ts`, `.github/workflows/database.yml`.
- Environment/security: `lib/env/server.ts`, `instrumentation.ts`, `proxy.ts`, `next.config.mjs`, `tests/env.test.ts`.
- Privacy/legal: `lib/legal/constants.ts`, `docs/privacy/`, `app/legal/`, `app/support/`.
- Moderation: `lib/release/flags.ts`, `app/api/v1/config/`, `review_photos`, `user_blocks`, review/photo reporting, admin queues.
- Observability: Sentry config, `lib/observability/`, `app/api/health/`, cron ledger, `.github/workflows/production-smoke.yml`.
- Native release evidence: `ios/WorkInCafe/Resources/PrivacyInfo.xcprivacy`, `.github/workflows/ios-ci.yml`, `docs/release/`.

### Task 1: Replay every migration and enforce generated database types

**Files:**
- Modify or create: `scripts/db`
- Modify or create: `docs/DATABASE_ACCESS.md`
- Modify: `supabase/config.toml`
- Modify: `supabase/README.md`
- Regenerate: `types/database.ts`
- Modify: `lib/supabase/client.ts`
- Modify: `lib/supabase/server.ts`
- Modify: `lib/supabase/admin.ts`
- Create: `tests/database-migration-smoke.test.ts`
- Create: `.github/workflows/database.yml`

**Interfaces:**
- Produces: `scripts/db migration-replay`, `local-smoke`, and `gen-types` as CI-owned operations.
- Consumes: all 43+ checked-in migrations and `Database` generic in every Supabase client.

- [ ] **Step 1: Write the failing repository-policy test**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('database release gate', () => {
  it('types every Supabase client and never documents direct db push', () => {
    for (const path of ['lib/supabase/client.ts', 'lib/supabase/server.ts', 'lib/supabase/admin.ts']) {
      expect(readFileSync(path, 'utf8')).toContain('createClient<Database>');
    }
    expect(readFileSync('supabase/README.md', 'utf8')).not.toContain('supabase db push');
  });
});
```

- [ ] **Step 2: Verify current hand-typed/direct-access behavior fails**

Run: `npm test -- tests/database-migration-smoke.test.ts`

Expected: FAIL because clients are not parameterized or README documents a bypass.

- [ ] **Step 3: Make replay/type generation wrapper-owned**

Disable the missing seed path in `supabase/config.toml` by setting `seed.enabled = false`. Update `scripts/db` so `migration-replay --write --force` creates/reset a disposable local project, applies every migration in lexical order, and `gen-types` emits `types/database.ts` without printing credentials.

- [ ] **Step 4: Add real RLS smoke fixtures**

Through wrapper commands, create user A/user B, insert representative places/reviews/favorites/photos, and prove anonymous visibility, owner mutation, different-user denial, banned-user denial, and service-role-only lifecycle paths. Source-string migration tests remain supplemental, not the replay gate.

- [ ] **Step 5: Verify and commit**

Run: `scripts/db self-test && scripts/db migration-replay --write --force && scripts/db local-smoke && scripts/db gen-types && git diff --exit-code -- types/database.ts && npm test -- tests/database-migration-smoke.test.ts`

Expected: empty-database replay and RLS smoke PASS; generated type diff is empty.

```bash
git add scripts/db docs/DATABASE_ACCESS.md supabase types/database.ts lib/supabase tests/database-migration-smoke.test.ts .github/workflows/database.yml
git commit -m "test: enforce database replay and RLS" -m "— gib"
```

### Task 2: Fail closed on production configuration and add security headers

**Files:**
- Create: `lib/env/server.ts`
- Create: `instrumentation.ts`
- Create: `tests/env.test.ts`
- Create: `tests/security-headers.test.ts`
- Modify: `proxy.ts`
- Modify: `next.config.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `validateServerEnv(environment): ServerEnv` and `environmentFailureResponse()`.
- Consumes: core Supabase/app/cron settings plus feature-specific Cloudinary/Sentry/Apple/Stripe settings.

- [ ] **Step 1: Write failing production-vs-preview tests**

```ts
describe('validateServerEnv', () => {
  it('throws in production when core Supabase settings are absent', () => {
    expect(() => validateServerEnv({ NODE_ENV: 'production', VERCEL_ENV: 'production' }))
      .toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('allows explicit local demo mode without production credentials', () => {
    expect(validateServerEnv({ NODE_ENV: 'development', WORKINCAFE_DEMO_MODE: '1' }).mode)
      .toBe('demo');
  });
});
```

- [ ] **Step 2: Verify the validator is missing**

Run: `npm test -- tests/env.test.ts`

Expected: FAIL because `lib/env/server.ts` does not exist.

- [ ] **Step 3: Implement one validated environment object**

```ts
export interface ServerEnv {
  mode: 'demo' | 'preview' | 'production';
  appUrl: URL;
  supabaseUrl: URL;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  cronSecret?: string;
  sentryDsn?: string;
  appleTeamId?: string;
}
```

Core production values are required at startup. Cloudinary is required when the photo flag can be enabled; Sentry DSN/release is required for production; Apple server credentials are required before Apple account deletion is exposed; Stripe is required only for enabled owner/deal features. Error messages list variable names, never values.

- [ ] **Step 4: Fail proxy closed and add headers**

Missing core production config returns 503; it never bypasses authorization. Add CSP, HSTS in production, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, and frame denial. CSP explicitly permits only required map/image/auth/payment origins.

- [ ] **Step 5: Update CI runtime, verify, and commit**

Change Actions Node from 20 to 22. Run: `npm test -- tests/env.test.ts tests/security-headers.test.ts && npm run lint && npm run typecheck && npm run build`.

Expected: fail-closed and header tests PASS and production build succeeds under Node 22.

```bash
git add lib/env/server.ts instrumentation.ts proxy.ts next.config.mjs tests/env.test.ts tests/security-headers.test.ts .github/workflows/ci.yml
git commit -m "fix: fail closed on production configuration" -m "— gib"
```

### Task 3: Replace inaccurate legal copy with an approved data inventory

**Files:**
- Create: `lib/legal/constants.ts`
- Create: `docs/privacy/data-inventory.md`
- Create: `docs/privacy/processors.md`
- Create: `docs/privacy/retention.md`
- Create: `app/support/page.tsx`
- Create: `app/legal/community-guidelines/page.tsx`
- Create: `tests/legal-pages.test.ts`
- Create: `e2e/legal.spec.ts`
- Modify: `app/legal/privacy/page.tsx`
- Modify: `app/legal/tos/page.tsx`
- Modify: `README.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: fixed `LEGAL_EFFECTIVE_DATE = '2026-07-15'`, support/privacy URLs, and one source-of-truth inventory.
- Consumes: owner/counsel-approved controller identity, physical/contact address, jurisdiction, age threshold, legal bases, and international-transfer basis recorded in issue #304 before this task merges.

- [ ] **Step 1: Record the legal fact gate in issue #304**

The repository owner supplies and explicitly approves these six facts in one issue comment: controller legal name, service address, governing jurisdiction, minimum age, GDPR/other legal bases, and international transfer mechanism. Do not create substitute values in code.

- [ ] **Step 2: Write failing fixed-date/claim tests**

```ts
it('uses a fixed effective date and only names configured processors', () => {
  const privacy = readFileSync('app/legal/privacy/page.tsx', 'utf8');
  expect(privacy).not.toContain('new Date()');
  expect(privacy).not.toContain('photos are never');
  expect(privacy).not.toContain('PostHog');
  expect(privacy).toContain('LEGAL_EFFECTIVE_DATE');
});
```

- [ ] **Step 3: Verify current copy fails**

Run: `npm test -- tests/legal-pages.test.ts`

Expected: FAIL on dynamic dates, photo denial, or nonexistent PostHog claim.

- [ ] **Step 4: Implement inventory, processors, retention, and support**

Inventory precise foreground location used transiently for geo verification, account identity, favorites, review content/photos, aggregate Wi-Fi/audio results, moderation reports, device diagnostics, and payment/owner records. Processors include Vercel, Supabase, Cloudinary, Sentry, Resend, Stripe, Apple/Google auth, and map providers when actually enabled. Operational retention defaults are: security/error logs 30 days, raw upload staging 24 hours, moderation reports 24 months, account content until deletion/moderation, and legally retained financial records anonymized from profile identity. Counsel approval can shorten/extend values only before merge with a documented reason.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/legal-pages.test.ts && npm run build && npm run test:e2e -- e2e/legal.spec.ts`

Expected: legal/support/community URLs return 200, critical links work, copy matches the inventory, and all effective dates are fixed.

```bash
git add lib/legal docs/privacy app/legal app/support tests/legal-pages.test.ts e2e/legal.spec.ts README.md AGENTS.md
git commit -m "docs: align privacy and support surfaces" -m "— gib"
```

### Task 4: Make public review photos fail closed through moderation and deletion

**Files:**
- Create: CLI-generated photo moderation migration
- Modify: `lib/release/flags.ts`
- Modify: `app/api/v1/config/route.ts`
- Modify: `app/api/v1/reviews/[reviewId]/photo-uploads/route.ts`
- Modify: `app/api/v1/reviews/[reviewId]/photos/[slot]/route.ts`
- Modify: `app/api/places/[id]/reviews/route.ts`
- Create: `lib/moderation/review-photos.ts`
- Create: `app/api/admin/review-photos/[id]/decision/route.ts`
- Create: `components/admin/ReviewPhotoModerationRow.tsx`
- Create: `tests/review-photo-moderation.test.ts`
- Modify: `lib/cloudinary-admin.ts`

**Interfaces:**
- Produces: `pending`, `approved`, `hidden`, and `deletion_pending` photo states plus typed deletion result.
- Consumes: default-off release flag and Cloudinary public IDs scoped to `workincafe/reviews/<reviewId>/`.

- [ ] **Step 1: Write failing disabled/pending/hidden serialization tests**

```ts
it.each(['disabled', 'pending', 'hidden', 'deletion_pending'] as const)(
  'never serializes a %s review photo',
  async (state) => {
    mocks.photoState = state;
    const response = await getPlaceReviews('place-a');
    expect(JSON.stringify(await response.json())).not.toContain('cloudinary.example');
  },
);
```

- [ ] **Step 2: Verify current read-all policy fails**

Run: `npm test -- tests/review-photo-moderation.test.ts`

Expected: FAIL because current review responses return every photo for visible reviews.

- [ ] **Step 3: Add moderation state and restrictive reads**

Run: `scripts/db migration-new moderate_review_photos`. Existing/new photos default to `pending`; public/RLS/API reads require `approved` and the public release flag. Signature/completion validates folder/review ID equality, owner, checksum, MIME, size, and slot.

- [ ] **Step 4: Make hide/delete auditable and retryable**

`deleteCloudinaryAsset()` returns `.deleted`, `.alreadyMissing`, or `.retryableFailure(code)` and never maps provider failure to an empty-success result. Hide immediately removes public serialization; deletion failure records `deletion_pending`; cron retry finishes provider deletion before row removal.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/review-photo-moderation.test.ts tests/cloudinary-sign-route.test.ts tests/review-photos-route.test.ts && scripts/db local-smoke`

Expected: disabled/pending/hidden/error states are non-public; approve/hide/delete/retry and folder ownership cases PASS.

```bash
git add supabase/migrations lib/release lib/moderation lib/cloudinary-admin.ts app/api components/admin tests/review-photo-moderation.test.ts
git commit -m "feat: moderate public review photos" -m "— gib"
```

### Task 5: Add report, block, and ban enforcement across every consumer write

**Files:**
- Create: CLI-generated user-block/report migration
- Create: `lib/moderation/user-blocks.ts`
- Create: `app/api/v1/users/[userId]/block/route.ts`
- Create: `app/api/v1/reports/route.ts`
- Create: native report/block actions under `ios/WorkInCafe/Features/Moderation/`
- Create: `tests/user-blocks.test.ts`
- Create: `tests/banned-contributions.test.ts`
- Create: `ios/WorkInCafeTests/Moderation/ModerationActionsTests.swift`
- Modify: all consumer read/write domain functions and submission RPCs.

**Interfaces:**
- Produces: idempotent block/unblock and report targets `review` or `reviewPhoto`.
- Consumes: actor user ID, target author, database-enforced `users.is_banned`, and blocked-author filters.

- [ ] **Step 1: Write failing two-user isolation and banned-RPC tests**

```ts
it('hides blocked authors from user A without changing anonymous visibility', async () => {
  await blockUser(USER_A, USER_B.id);
  expect(await visibleReviews({ actor: USER_A })).not.toContainEqual(expect.objectContaining({ userId: USER_B.id }));
  expect(await visibleReviews({ actor: null })).toContainEqual(expect.objectContaining({ userId: USER_B.id }));
});

it('rejects a banned user inside the submission RPC', async () => {
  await expect(directSubmitAs(BANNED_USER)).rejects.toMatchObject({ code: '42501' });
});
```

- [ ] **Step 2: Verify current absence/permissive writes fail**

Run: `npm test -- tests/user-blocks.test.ts tests/banned-contributions.test.ts`

Expected: FAIL because block routes/tables do not exist or banned direct writes succeed.

- [ ] **Step 3: Add database and route enforcement**

Run: `scripts/db migration-new user_blocks_and_report_targets`. Reject self-block, unique `(blocker_id, blocked_id)`, idempotent unblock, duplicate/rate-limited reports, and all writes by banned users in route plus RPC/RLS. Payloads cannot select reporter/blocker/user IDs.

- [ ] **Step 4: Add native recovery actions**

Place report/block in review/photo context menus with confirmation, error recovery, and immediate filtered refresh. Admin ban/hide decisions remain atomic and create an audit record.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/user-blocks.test.ts tests/banned-contributions.test.ts tests/api-v1-auth-parity.test.ts && scripts/db local-smoke && scripts/ios-test --only WorkInCafeTests/Moderation`

Expected: two-user isolation, self-block, idempotency, report rate limit, photo target, banned route/direct-RPC, and native action tests PASS.

```bash
git add supabase/migrations lib/moderation app/api/v1 ios/WorkInCafe/Features/Moderation ios/WorkInCafeTests/Moderation tests
git commit -m "feat: enforce UGC reporting and blocking" -m "— gib"
```

### Task 6: Add privacy-redacted observability, health checks, and cron ledger

**Files:**
- Install/modify: `package.json`, `package-lock.json`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation-client.ts`
- Create: `lib/observability/redact.ts`
- Create: `lib/observability/logger.ts`
- Create: `app/api/health/route.ts`
- Create: CLI-generated cron-run migration
- Modify: all `app/api/cron/**/route.ts`
- Create: `.github/workflows/production-smoke.yml`
- Create: `tests/observability-redaction.test.ts`
- Create: `tests/health-route.test.ts`
- Create: `tests/cron-ledger.test.ts`
- Create: `docs/release/incident-and-rollback.md`

**Interfaces:**
- Produces: request IDs, redacted structured events, health status, and stale-cron alert.
- Consumes: Sentry DSN/release in production and independent GitHub smoke workflow.

- [ ] **Step 1: Install exact web error reporting**

Run: `npm install --save-exact @sentry/nextjs@10.65.0`

Expected: exact version is locked.

- [ ] **Step 2: Write failing secret/location redaction tests**

```ts
it('removes tokens, cookies, authorization, and exact coordinates recursively', () => {
  expect(redactEvent({ authorization: 'Bearer abc', cookie: 'session=x', lat: 48.856613, lng: 2.352222, nested: { refreshToken: 'secret' } }))
    .toEqual({ authorization: '[REDACTED]', cookie: '[REDACTED]', lat: 48.86, lng: 2.35, nested: { refreshToken: '[REDACTED]' } });
});
```

- [ ] **Step 3: Verify redaction/health modules are missing**

Run: `npm test -- tests/observability-redaction.test.ts tests/health-route.test.ts`

Expected: FAIL on missing modules.

- [ ] **Step 4: Implement redacted reporting and independent health**

Send exception class, route, request ID, release, and coarse two-decimal region only; drop bodies, headers, tokens, user email, raw audio, image bytes, and exact coordinates. Health checks env readiness plus a bounded anonymous database read and returns only `ok/degraded`, release, and component names—never provider errors or secrets.

- [ ] **Step 5: Add cron ledger and external stale-run detection**

Run: `scripts/db migration-new cron_run_ledger`. Each cron records start/success/failure with redacted code. The independent scheduled workflow calls `/api/health` and a protected cron-status endpoint; it alerts when a scheduled job is stale even if the job failed before writing its ledger.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/observability-redaction.test.ts tests/health-route.test.ts tests/cron-ledger.test.ts && npm run build`

Expected: redaction, degraded health, missing-env, stale-cron, provider failure, and request-ID tests PASS.

```bash
git add package.json package-lock.json sentry* instrumentation-client.ts lib/observability app/api/health app/api/cron supabase/migrations .github/workflows/production-smoke.yml tests docs/release/incident-and-rollback.md
git commit -m "feat: add release observability and health" -m "— gib"
```

### Task 7: Add iOS privacy manifest, CI, and automated release matrix

**Files:**
- Create: `ios/WorkInCafe/Resources/PrivacyInfo.xcprivacy`
- Create: `ios/WorkInCafe/Core/Support/MetricSubscriber.swift`
- Create: `ios/WorkInCafeTests/Privacy/PrivacyManifestTests.swift`
- Create: `.github/workflows/ios-ci.yml`
- Create: `docs/release/device-matrix.md`
- Create: `docs/release/privacy-inventory.md`
- Modify: `ios/project.yml`
- Modify: `ios/WorkInCafe/Info.plist`

**Interfaces:**
- Produces: valid bundled privacy manifest, purpose strings, MetricKit subscriber, and unsigned CI analysis/test gate.
- Consumes: Xcode 26 on GitHub `macos-26` plus physical-device evidence outside CI.

- [ ] **Step 1: Write failing manifest/usage-description tests**

```swift
@Test("privacy manifest is bundled and tracking is false")
func privacyManifest() throws {
    let url = try #require(Bundle.main.url(forResource: "PrivacyInfo", withExtension: "xcprivacy"))
    let data = try Data(contentsOf: url)
    let plist = try #require(PropertyListSerialization.propertyList(from: data) as? [String: Any])
    #expect(plist["NSPrivacyTracking"] as? Bool == false)
}
```

- [ ] **Step 2: Verify manifest is missing**

Run: `scripts/ios-test --only WorkInCafeTests/Privacy`

Expected: FAIL because the resource does not exist.

- [ ] **Step 3: Add accurate purpose strings and privacy declarations**

Info.plist explains foreground venue discovery/geo verification, user-started approximate ambient measurement, chosen camera capture, and chosen photo-library selection. Privacy manifest declares tracking false, collected categories/purposes matching `docs/release/privacy-inventory.md`, and each required-reason API category actually found in app/package archive scanning. For FileManager timestamps/UserDefaults usage, use only Apple-approved reasons that match cache/preferences functionality; do not add unused categories.

- [ ] **Step 4: Add macOS 26 CI**

```yaml
jobs:
  ios-verify:
    runs-on: macos-26
    steps:
      - uses: actions/checkout@v7
      - run: xcodebuild -version
      - run: xcodegen generate --spec ios/project.yml
      - run: swift test --package-path ios/Packages/WorkInCafeCore
      - run: xcodebuild test -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -destination 'platform=iOS Simulator,name=iPhone 16e,OS=latest'
      - run: xcodebuild analyze -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO
```

- [ ] **Step 5: Verify and commit**

Run: `plutil -lint ios/WorkInCafe/Info.plist ios/WorkInCafe/Resources/PrivacyInfo.xcprivacy && scripts/ios-test --only WorkInCafeTests/Privacy && xcodebuild analyze -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO`

Expected: plist, privacy, tests, and unsigned analysis PASS.

```bash
git add ios .github/workflows/ios-ci.yml docs/release/device-matrix.md docs/release/privacy-inventory.md
git commit -m "test: add native privacy and CI gates" -m "— gib"
```

### Task 8: Close security alerts and execute the external TestFlight gate

**Files:**
- Create: `docs/security/alert-disposition.md`
- Create: `docs/release/moderation-runbook.md`
- Create: `docs/release/testflight.md`
- Create: `docs/release/release-checklist.md`
- Create: `e2e/account-lifecycle.spec.ts`
- Create: `e2e/moderation.spec.ts`
- Create: `ios/WorkInCafeUITests/AccountLifecycleTests.swift`
- Create: `ios/WorkInCafeUITests/ModerationTests.swift`

**Interfaces:**
- Produces: one signed external-beta decision with automated and manual evidence.
- Consumes: CodeQL/Dependabot inventory, Playwright/axe, XCUITest, physical devices, monitoring, and feature flags.

- [ ] **Step 1: Triage every current alert**

Use `gh api`/`gh` to list CodeQL and Dependabot alerts. Fix clear-text location, weak randomness, SHA-1, workflow-permission, and dependency findings where still present. A false positive entry records alert URL, code owner, technical justification, compensating control, and expiry date no more than 90 days away.

- [ ] **Step 2: Run web account/moderation/accessibility journeys**

Run: `npm run test:e2e -- e2e/account-lifecycle.spec.ts e2e/moderation.spec.ts e2e/map-accessibility.spec.ts && npm run test:a11y`

Expected: export/delete/revoke, report/block/hide/delete/ban, keyboard, and zero serious/critical axe violations PASS.

- [ ] **Step 3: Run native account/moderation/accessibility journeys**

Run: `scripts/ios-test --ui-only WorkInCafeUITests/AccountLifecycleTests --ui-only WorkInCafeUITests/ModerationTests --ui-only WorkInCafeUITests/AccessibilityTests`

Expected: native export/share, fresh Apple reauth deletion, report/block, VoiceOver identifiers/actions, Dynamic Type, and Reduce Motion tests PASS.

- [ ] **Step 4: Execute physical-device and operational matrix**

Use an iPhone 11-class iOS 18 baseline, compact supported iPhone, and current iOS 26 device. Cover terminated OAuth return, denied/approximate/revoked permissions, offline/lossy networks, camera formats, microphone interruption, memory pressure, energy, and 10-minute map trace. Run a monitoring/rollback drill and keep public photos off until every moderation item is signed.

- [ ] **Step 5: Run the full release gate and commit evidence**

Run:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run bundle:check
npm run test:e2e
npm run test:a11y
npm audit --omit=dev
scripts/db migration-replay --write --force
scripts/db local-smoke
swift test --package-path ios/Packages/WorkInCafeCore
scripts/ios-test
```

Expected: all automated checks PASS and `docs/release/release-checklist.md` records no P0/P1 defects.

```bash
git add docs/security docs/release e2e ios/WorkInCafeUITests
git commit -m "docs: approve external TestFlight gate" -m "— gib"
```

## Milestone completion gate

- Public photos remain off until moderation/blocking/deletion and Cloudinary cleanup are independently proven; enabling the flag requires a separate audited production change.
- Legal facts, App Store privacy inventory, physical-device matrix, monitoring drill, alert disposition, and account lifecycle are signed before external testers are invited.
- Open the PR with `Closes #304`, full automated output, manual/physical evidence, legal approval link, and rollback plan; self-review the GitHub diff before merge.
