# TestFlight and App Store Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reproducibly sign, archive, beta-test, submit, release, and monitor Work in Cafe as a native iPhone app in the Apple App Store.

**Architecture:** A repo-owned `scripts/appstore` wrapper reads non-repository App Store Connect credentials from the canonical INI store, drives Xcode archive/export and Apple upload/status APIs without printing secrets, and records redacted evidence. Store metadata/assets are versioned with the app; internal and external TestFlight, App Review, and production release remain separate decision gates so any stage can reject the build without bypassing safety.

**Tech Stack:** Xcode 26, Swift 6, xcodebuild, altool/App Store Connect API, `jose` 6.2.3, TestFlight, App Store Connect, MetricKit, Xcode Organizer, Sentry web/API monitoring.

## Global Constraints

- Tracking issue: [#305](https://github.com/gibouu/workincafe/issues/305); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- Hard dependency: issue #304 is merged and the external-TestFlight safety checklist is signed with no P0/P1 defects.
- App identity: name `Work in Cafe`, bundle identifier `cafe.workin.app`, iPhone only, iOS 18.0 minimum, initial marketing version `1.0.0`.
- Build/upload uses Xcode 26 and the required iOS SDK; every build number is unique and monotonically increasing.
- Private-key material, JWTs, certificates, provisioning profiles, reviewer credentials, and private legal information never enter the repository, tool arguments, logs, screenshots, or issue comments. Apple requires the non-secret key ID and issuer ID for command-line authentication; only `scripts/appstore` may pass those identifiers in argv, and all human/error output redacts them to the final four characters.
- Canonical credential file is `~/.config/appstoreconnect-cli/accounts.ini`, mode `600`, section `[workincafe]`.
- A binary cannot be rolled back; rollback means pause phased release, disable risky server flags, preserve additive API compatibility, and submit a tested hotfix.
- Every commit and PR body ends with `— gib` and contains no AI trailer.

---

## File map

- Credential-safe tooling: `scripts/appstore`, `scripts/appstore-api.ts`, `tests/appstore-cli.test.ts`, `docs/release/app-store-connect.md`.
- Signing/archive: `ios/WorkInCafe/WorkInCafe.entitlements`, `ios/Config/Release.xcconfig`, `ios/Config/AppStoreExportOptions.plist`, `ios/project.yml`.
- Store package: `ios/AppStore/metadata/en-US/`, `ios/AppStore/screenshots/en-US/`, `ios/AppStore/review-notes.md`, privacy/compliance inventories.
- Evidence/runbooks: `docs/release/{testflight,release-checklist,production-rollout}.md` and ignored `.artifacts/`.

### Task 1: Create a credential-safe App Store Connect wrapper

**Files:**
- Create: `scripts/appstore`
- Create: `scripts/appstore-api.ts`
- Create: `tests/appstore-cli.test.ts`
- Create: `docs/release/app-store-connect.md`
- Modify: `.gitignore`
- Modify: `AGENTS.md`

**Interfaces:**
- Produces: `doctor`, `bootstrap`, `archive`, `export`, `validate`, `upload`, `build-status`, `internal-beta`, `external-beta`, and `submit` subcommands.
- Consumes: `[workincafe]` keys `issuer_id`, `key_id`, `private_key_path`, `team_id`, `bundle_id`, `apple_id`, `release_owner`, `incident_commander`, `privacy_contact`, and `support_owner`.

- [ ] **Step 1: Write the failing pre-credential safety test**

```ts
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function fixtureHome(mode: 'mode-0600' | 'mode-0644'): string {
  const home = mkdtempSync(join(tmpdir(), 'wic-appstore-'));
  const configDirectory = join(home, '.config', 'appstoreconnect-cli');
  const keyPath = join(home, 'AuthKey_test.p8');
  const accountsPath = join(configDirectory, 'accounts.ini');
  mkdirSync(configDirectory, { recursive: true });
  writeFileSync(keyPath, '-----BEGIN PRIVATE KEY-----\ntest-only\n-----END PRIVATE KEY-----\n');
  chmodSync(keyPath, 0o600);
  writeFileSync(accountsPath, `[workincafe]\nissuer_id=test-issuer\nkey_id=test-key\nprivate_key_path=${keyPath}\nteam_id=test-team\nbundle_id=cafe.workin.app\napple_id=1234567890\nrelease_owner=release-test\nincident_commander=incident-test\nprivacy_contact=privacy-test\nsupport_owner=support-test\n`);
  chmodSync(accountsPath, mode === 'mode-0600' ? 0o600 : 0o644);
  return home;
}

describe('scripts/appstore', () => {
  it('rejects a permissive credential file without printing its contents', () => {
    const result = spawnSync('scripts/appstore', ['doctor'], {
      encoding: 'utf8',
      env: { ...process.env, HOME: fixtureHome('mode-0644') },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('chmod 600');
    expect(`${result.stdout}${result.stderr}`).not.toContain('BEGIN PRIVATE KEY');
  });
});
```

- [ ] **Step 2: Verify the wrapper is missing**

Run: `npm test -- tests/appstore-cli.test.ts`

Expected: FAIL with `ENOENT` for `scripts/appstore`.

- [ ] **Step 3: Implement strict INI loading, redaction, and idempotent app bootstrap**

Read one section only, require mode `600`, resolve/verify private key path outside the repo, ensure bundle ID equals `cafe.workin.app`, and redact issuer/key/team IDs to their final four characters in human logs. Never echo JWTs or private-key material. `doctor` checks Xcode major 26, the API key file, agreements/role through App Store Connect API, and app/bundle record existence without mutating them.

`scripts/appstore bootstrap` is an explicit, idempotent mutation: after interactive operator confirmation, it resolves or creates the `cafe.workin.app` bundle-ID record and the `Work in Cafe` iOS app record, records their non-secret Apple IDs in the canonical external INI, and verifies associated-domains plus Sign in with Apple capability state. If the API role cannot create or configure a record, it stops with an exact App Store Connect/Developer portal checklist; `scripts/appstore bootstrap --verify` then records redacted evidence after the Account Holder completes it. No archive or upload command runs until `bootstrap --verify` passes.

- [ ] **Step 4: Implement short-lived API JWTs in memory**

```ts
const token = await new SignJWT({})
  .setProtectedHeader({ alg: 'ES256', kid: config.keyId, typ: 'JWT' })
  .setIssuer(config.issuerId)
  .setAudience('appstoreconnect-v1')
  .setIssuedAt(now)
  .setExpirationTime(now + 15 * 60)
  .sign(await importPKCS8(privateKey, 'ES256'));
```

Use the JWT only in HTTPS Authorization headers, redact it from errors, and discard it at process exit.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/appstore-cli.test.ts && scripts/appstore doctor --offline && scripts/appstore bootstrap --offline-check`

Expected: mode, missing-key, repo-path, bundle-mismatch, redaction, app-record idempotency, and offline Xcode/config tests PASS.

```bash
git add scripts/appstore scripts/appstore-api.ts tests/appstore-cli.test.ts docs/release/app-store-connect.md .gitignore AGENTS.md
git commit -m "chore: add App Store delivery wrapper" -m "— gib"
```

### Task 2: Configure entitlements, signing, and reproducible archives

**Files:**
- Create: `ios/WorkInCafe/WorkInCafe.entitlements`
- Create: `ios/Config/AppStoreExportOptions.plist`
- Create: `tests/appstore-signing-config.test.ts`
- Modify: `ios/Config/Release.xcconfig`
- Modify: `ios/project.yml`
- Modify: `scripts/appstore`

**Interfaces:**
- Produces: Release archive at `.artifacts/WorkInCafe.xcarchive` and IPA at `.artifacts/export/WorkInCafe.ipa`.
- Consumes: development team and API key path from canonical config; associated domain and Sign in with Apple entitlements only.

- [ ] **Step 1: Write the failing entitlement/config test**

```ts
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readPlist(path: string): Record<string, unknown> {
  return JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8' }));
}

it('ships only approved v1 entitlements and exact app identity', () => {
  const entitlements = readPlist('ios/WorkInCafe/WorkInCafe.entitlements');
  expect(entitlements['com.apple.developer.associated-domains']).toEqual(['applinks:workin.cafe']);
  expect(entitlements['com.apple.developer.applesignin']).toEqual(['Default']);
  expect(entitlements).not.toHaveProperty('aps-environment');
  expect(entitlements).not.toHaveProperty('com.apple.developer.location.push');
  expect(readFileSync('ios/Config/Release.xcconfig', 'utf8')).toContain('PRODUCT_BUNDLE_IDENTIFIER = cafe.workin.app');
});
```

- [ ] **Step 2: Verify the signing artifacts are missing**

Run: `npm test -- tests/appstore-signing-config.test.ts`

Expected: FAIL on missing entitlement or export plist.

- [ ] **Step 3: Implement exact entitlements and release settings**

```text
PRODUCT_BUNDLE_IDENTIFIER = cafe.workin.app
MARKETING_VERSION = 1.0.0
SWIFT_VERSION = 6.0
IPHONEOS_DEPLOYMENT_TARGET = 18.0
TARGETED_DEVICE_FAMILY = 1
CODE_SIGN_STYLE = Automatic
DEVELOPMENT_TEAM = $(WIC_DEVELOPMENT_TEAM)
CURRENT_PROJECT_VERSION = $(WIC_BUILD_NUMBER)
```

Export options use `method = app-store-connect`, `signingStyle = automatic`, `uploadSymbols = true`, and `manageAppVersionAndBuildNumber = false`.

- [ ] **Step 4: Implement wrapper-owned archive/export commands**

Build number format is UTC `yyyyMMddHHmm` and must exceed the latest uploaded build. `archive` runs `xcodegen`, all tests, Release analysis, and only the archive command:

```bash
xcodebuild archive -project ios/WorkInCafe.xcodeproj -scheme WorkInCafe -configuration Release -destination 'generic/platform=iOS' -archivePath .artifacts/WorkInCafe.xcarchive -allowProvisioningUpdates
```

`export` first verifies that the archive bundle ID, commit, version, and build equal the current release-candidate record, then runs only:

```bash
xcodebuild -exportArchive -archivePath .artifacts/WorkInCafe.xcarchive -exportPath .artifacts/export -exportOptionsPlist ios/Config/AppStoreExportOptions.plist -allowProvisioningUpdates
```

The wrapper supplies team/build/authentication settings through an ephemeral xcconfig with mode `600`, then deletes it.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/appstore-signing-config.test.ts && plutil -lint ios/WorkInCafe/WorkInCafe.entitlements ios/Config/AppStoreExportOptions.plist && scripts/appstore archive --unsigned-check`

Expected: identity/entitlement tests PASS and unsigned Release archive analysis completes.

```bash
git add ios/WorkInCafe/WorkInCafe.entitlements ios/Config ios/project.yml scripts/appstore tests/appstore-signing-config.test.ts
git commit -m "chore: configure App Store archives" -m "— gib"
```

### Task 3: Prepare versioned App Store metadata, icon, screenshots, and review package

**Files:**
- Create: `ios/WorkInCafe/Resources/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Create: app icon PNG assets in that appiconset
- Create: `ios/AppStore/metadata/en-US/name.txt`
- Create: `ios/AppStore/metadata/en-US/subtitle.txt`
- Create: `ios/AppStore/metadata/en-US/description.txt`
- Create: `ios/AppStore/metadata/en-US/keywords.txt`
- Create: `ios/AppStore/metadata/en-US/promotional-text.txt`
- Create: `ios/AppStore/metadata/en-US/support-url.txt`
- Create: `ios/AppStore/metadata/en-US/privacy-url.txt`
- Create: `ios/AppStore/metadata/en-US/release-notes.txt`
- Create: `ios/AppStore/review-notes.md`
- Create: `ios/AppStore/privacy-inventory.md`
- Create: `ios/AppStore/export-compliance.md`
- Create: `ios/AppStore/content-rights.md`
- Create: `ios/AppStore/age-rating.md`
- Create: `ios/AppStore/requirements.json`
- Create: `ios/AppStore/screenshots/en-US/iphone-6.9/*.png`
- Create: `tests/appstore-metadata.test.ts`

**Interfaces:**
- Produces: one English v1 listing and deterministic screenshot set.
- Consumes: production privacy/support URLs and UI-test fixture mode with synthetic place/user data.

- [ ] **Step 1: Write failing asset/string validation**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const metadataRoot = 'ios/AppStore/metadata/en-US';
const iconRoot = 'ios/WorkInCafe/Resources/Assets.xcassets/AppIcon.appiconset';
const requirements = JSON.parse(readFileSync('ios/AppStore/requirements.json', 'utf8'));

function text(name: string): string {
  return readFileSync(join(metadataRoot, name), 'utf8').trim();
}

function readPNG(name: string): { width: number; height: number; hasAlpha: boolean } {
  const bytes = readFileSync(join(iconRoot, name));
  if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${name} is not a PNG`);
  }
  const colorType = bytes[25];
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    hasAlpha: colorType === 4 || colorType === 6,
  };
}

it('meets app metadata limits and required URLs', () => {
  expect(text('name.txt')).toBe('Work in Cafe');
  expect(text('name.txt').length).toBeLessThanOrEqual(30);
  expect(text('subtitle.txt').length).toBeLessThanOrEqual(30);
  expect(text('keywords.txt').length).toBeLessThanOrEqual(100);
  expect(text('support-url.txt')).toBe('https://workin.cafe/support');
  expect(text('privacy-url.txt')).toBe('https://workin.cafe/legal/privacy');
  expect(readPNG('AppIcon-1024.png')).toMatchObject({ width: 1024, height: 1024, hasAlpha: false });
  expect(requirements).toMatchObject({
    verifiedOn: '2026-07-15',
    screenshotDevice: 'iPhone 17 Pro Max',
    screenshotRuntime: 'iOS 26.5',
    locale: 'en-US',
    appearance: 'light',
    portraitPixels: { width: 1320, height: 2868 },
  });
});
```

- [ ] **Step 2: Verify the store package is missing**

Run: `npm test -- tests/appstore-metadata.test.ts`

Expected: FAIL on missing metadata/icon.

- [ ] **Step 3: Write the approved initial listing**

Use:

```text
Name: Work in Cafe
Subtitle: Find your best work spot
Keywords: cafe,wifi,remote work,study,quiet,outlets,coworking,map,workspace
Promotional text: Find cafés, libraries and work-friendly spaces with the details that matter for a productive session.
```

Description explains native map/search, work-specific venue details, favorites, geo-verified community updates, Wi-Fi/noise estimates, and privacy controls without promising unavailable owner/deal/photo features.

- [ ] **Step 4: Generate deterministic truthful screenshot fixtures**

Version `requirements.json` with the official Apple screenshot-specification URL, verification date, exact accepted dimensions, simulator/runtime, locale, appearance, and required file count. For v1 it pins `iPhone 17 Pro Max`, `iOS 26.5`, `en-US`, light appearance, portrait `1320 × 2868`, PNG, and five files. `scripts/appstore validate-metadata` refuses a requirements record older than 30 days and instructs the operator to re-verify Apple’s current specification before changing it.

Capture `01-map-discovery`, `02-search`, `03-place-details`, `04-review`, and `05-favorites-profile` from the Release-equivalent `-ui-testing -fixture app-store-en-US` build. Boot only the pinned simulator, set locale/appearance before launch, reset status-bar overrides before each capture, and validate every PNG as exactly 1320 × 2868. No device frames, production user data, unsupported claims, or photo UI while the flag is off.

- [ ] **Step 5: Complete reviewer/compliance documents**

Review notes explain test account flow, location/microphone/camera/photo permission triggers, account deletion path, report/block paths, feature flags, and why background location/push are absent. Reviewer credentials go only in App Store Connect protected fields. Privacy inventory matches `PrivacyInfo.xcprivacy`; export compliance records ordinary HTTPS cryptography and any required Apple questionnaire answer; content rights list map/data/image licenses.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/appstore-metadata.test.ts && scripts/appstore validate-metadata --offline`

Expected: character limits, PNG dimensions/alpha, five screenshot files, URLs, required documents, and prohibited-claim scans PASS.

```bash
git add ios/WorkInCafe/Resources/Assets.xcassets/AppIcon.appiconset ios/AppStore tests/appstore-metadata.test.ts
git commit -m "docs: prepare App Store listing" -m "— gib"
```

### Task 4: Archive, validate, upload, and complete internal TestFlight

**Files:**
- Create: `docs/release/testflight-internal.md`
- Modify: `scripts/appstore`
- Modify: `docs/release/release-checklist.md`

**Interfaces:**
- Produces: processed App Store Connect build assigned to internal TestFlight group.
- Consumes: green issue #304 gate, signed archive, App Store Connect API role, and protected internal testers.

- [ ] **Step 1: Run the immutable pre-archive gate**

Run: `scripts/appstore doctor && npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e && scripts/db local-smoke && swift test --package-path ios/Packages/WorkInCafeCore && scripts/ios-test`

Expected: every command PASS and git status is clean at the release candidate commit.

- [ ] **Step 2: Create and locally validate the signed archive**

Run: `scripts/appstore archive && scripts/appstore export && scripts/appstore validate`

The validate subcommand calls:

```bash
xcrun altool --validate-app -f .artifacts/export/WorkInCafe.ipa -t ios --apiKey "$WIC_ASC_KEY_ID" --apiIssuer "$WIC_ASC_ISSUER_ID"
```

Expected: Apple validation returns success with no missing icons, purpose strings, entitlement, privacy manifest, signing, or version errors.

- [ ] **Step 3: Upload and wait for processing**

Run: `scripts/appstore upload && scripts/appstore build-status --wait`

Upload calls `xcrun altool --upload-app` with API key/issuer identifiers; the private key is discovered from its canonical external path. Poll with exponential backoff capped at five minutes, stop after 60 minutes, and surface Apple delivery IDs/redacted errors.

- [ ] **Step 4: Assign internal testers and run smoke matrix**

Run: `scripts/appstore internal-beta --group workincafe-internal`

Test first launch, guest map/search/detail, Apple/Google auth, favorites, contribution draft, permissions, export/delete, report/block, offline recovery, and disabled-photo behavior on at least one iOS 18 and one current iOS 26 physical device.

- [ ] **Step 5: Record decision and commit**

Internal beta passes only after at least five distinct testers, 50 completed sessions, and 24 hours on the candidate with: zero P0/P1 defects; crash-free sessions at least 99.5%; 20/20 scripted Apple/Google auth-return attempts; consumer API 5xx below 1%; cached cold launch p95 at or below 1.5 seconds; warm interaction p95 at or below 750 ms; and no permission indicator left active after dismissal. Record build/version, device/OS, tester initials, metric queries, known P2/P3 issues, and rollback flag state. `release_owner` signs the result; `incident_commander` can reject it.

```bash
git add docs/release/testflight-internal.md docs/release/release-checklist.md
git commit -m "docs: approve internal TestFlight build" -m "— gib"
```

### Task 5: Complete external TestFlight and Beta App Review

**Files:**
- Create: `docs/release/testflight-external.md`
- Modify: `scripts/appstore-api.ts`
- Modify: `docs/release/release-checklist.md`

**Interfaces:**
- Produces: external beta build approved by Beta App Review and signed tester matrix.
- Consumes: internal-beta-approved build, beta description, feedback email, and external group.

- [ ] **Step 1: Submit the existing build for Beta App Review**

Run: `scripts/appstore external-beta --group workincafe-external --submit-review`

The API command attaches beta localized description, review contact, demo/reviewer instructions, export compliance, and the already processed build. It never creates a different binary.

- [ ] **Step 2: Execute the external matrix**

External testers cover terminated-app OAuth return, denied/approximate/revoked location, microphone interruption, supported camera/photo formats with the flag state stated, offline/slow/lossy networks, map density, VoiceOver/Dynamic Type/Reduce Motion, account export/delete, report/block, and 10-minute memory/energy trace.

- [ ] **Step 3: Triage every beta finding through the repo workflow**

P0/P1 findings block the beta and become separate issues, branches, TDD fixes, PRs, and new builds. P2/P3 findings receive an owner and target release; none are hidden in release notes. Re-run the complete affected matrix for any replacement build.

- [ ] **Step 4: Record external acceptance and commit**

Pass only after at least 20 distinct testers, 200 completed sessions, and 72 hours on the unchanged candidate with: zero P0/P1 defects; crash-free sessions at least 99.8%; hang rate below 0.1%; Apple/Google auth success at least 98%; consumer API 5xx below 0.5%; cached cold launch p95 at or below 1.5 seconds; warm interaction p95 at or below 750 ms; 100% of test reports visible to moderators within one minute; 100% of block actions effective on the next read; and every test deletion completed within 24 hours. Accessibility and permission matrices must also be complete. `release_owner`, `privacy_contact`, and `support_owner` sign; `incident_commander` can reject.

```bash
git add docs/release/testflight-external.md docs/release/release-checklist.md
git commit -m "docs: approve external TestFlight build" -m "— gib"
```

### Task 6: Submit for App Review and release with monitored rollout

**Files:**
- Create: `docs/release/app-review.md`
- Create: `docs/release/production-rollout.md`
- Modify: `scripts/appstore-api.ts`
- Modify: `docs/release/release-checklist.md`

**Interfaces:**
- Produces: submitted version `1.0.0`, phased production release, and post-launch health review.
- Consumes: accepted external build, approved store package, agreements/tax/banking status, and App Store Connect role.

- [ ] **Step 1: Create/attach the store version and metadata**

Run: `scripts/appstore submit --version 1.0.0 --approved-external-build --phased-release`

The command uploads metadata/screenshots, attaches privacy/support URLs, age rating, content rights, export compliance, reviewer notes, and the exact external-beta-approved build. It refuses submission when agreements, privacy responses, screenshots, or required fields are incomplete.

- [ ] **Step 2: Perform final App Store Connect and binary inspection**

Confirm bundle/version/build, iPhone-only device family, iOS 18 minimum, entitlements, privacy manifest report, encryption answer, data-collection labels, support/privacy URL 200 responses, reviewer credentials, moderation paths, account deletion, and production feature flags. Save redacted submission evidence.

- [ ] **Step 3: Handle App Review feedback without bypassing gates**

Answer information requests in App Store Connect. Any binary or behavior change uses a new GitHub issue/branch/TDD PR, full affected regression matrix, incremented build, internal beta, and external beta when risk affects testers. Do not alter production server behavior solely to make reviewer flows pass unless the behavior is correct for all users.

- [ ] **Step 4: Release gradually and monitor**

Use Apple phased release when available. The named `release_owner` reviews API health, Sentry, auth success, and launch signals at T+15 minutes, T+1 hour, T+4 hours, T+12 hours, T+24 hours, then once daily through day 7; `privacy_contact` reviews moderation/deletion queues and `support_owner` reviews support/App Store feedback at each handoff. The `incident_commander` has pause authority at every checkpoint.

Pause phased release immediately for any P0, two related P1 reports, crash-free sessions below 99.8% over a rolling hour, hang rate at or above 0.1%, launch failure at or above 1%, auth success below 97%, consumer API 5xx at or above 1%, cached cold-launch p95 above 2 seconds, an unreviewed high-risk report older than 24 hours, or a deletion job older than 24 hours without an active retry owner. Disable the affected server flag when possible and submit a tested hotfix for binary faults; advancement requires two consecutive healthy checkpoints and `release_owner` approval.

- [ ] **Step 5: Complete post-launch review and close the program**

After seven stable days, record adoption, crash-free sessions, launch/selection budgets, API error rate, moderation/deletion latency, support themes, and follow-up issues. Close #305 and then #298 only after App Store status is accepted and production installation/launch is verified.

```bash
git add docs/release/app-review.md docs/release/production-rollout.md docs/release/release-checklist.md scripts/appstore-api.ts
git commit -m "docs: complete App Store rollout" -m "— gib"
```

## Milestone completion gate

- App Store Connect shows version 1.0.0 accepted; the production listing, privacy/support URLs, screenshots, and binary identity are correct.
- A clean-device App Store install can launch, discover a place, authenticate, favorite, submit a geo-verified contribution, export data, and request account deletion.
- Monitoring and support ownership are active; rollback/kill-switch/hotfix procedures have named operators and were exercised before launch.
- Open the implementation PR with `Closes #305`, redacted archive/upload/beta/submission evidence, and the post-launch checklist; self-review the GitHub diff before merge.
