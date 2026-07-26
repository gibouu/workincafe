> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: native iOS program paused; see docs/decisions/source/01-reconstruction.md and the deferred register; branch state preserved in git. See `docs/RECONSTRUCTION.md`.

# Consumer API and Native Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a versioned consumer API, generated Swift client, secure bearer authentication, universal links, and complete account export/deletion without weakening browser authorization or Supabase RLS.

**Architecture:** New `/api/v1` handlers adapt existing domain behavior into stable camelCase contracts defined by one OpenAPI 3.1 document. A single request actor gives explicit precedence to validated bearer credentials over browser cookies, while public reads use an anonymous Supabase client and protected writes retain server geo/rate checks. A Swift package generates client code at build time and owns Keychain/session/link primitives before the app UI is built.

**Tech Stack:** Next.js 16.2.9, TypeScript 5.6, Supabase JS 2.108.2, OpenAPI 3.1, Redocly CLI 2.39.0, openapi-typescript 7.13.0, Ajv 8.20.0, Swift 6, Swift OpenAPI Generator 1.13.0, OpenAPI Runtime 1.12.0, OpenAPI URLSession 1.3.1, XCTest.

## Global Constraints

- Tracking issue: [#301](https://github.com/gibouu/workincafe/issues/301); parent design: [#298](https://github.com/gibouu/workincafe/issues/298).
- API versioning uses the `/api/v1` path prefix; deployed v1 clients receive additive-compatible responses.
- Bearer credentials use the Supabase anon/publishable key plus user access token; ordinary native routes never use the service-role client.
- A supplied malformed, invalid, or expired bearer token never falls back to a valid cookie.
- Demo-cookie fallback remains browser-only and is never accepted by `/api/v1` native authentication.
- Geo-verified review/check-in/write distance is 150 meters; request locations include horizontal accuracy and capture time, and server/RLS checks are authoritative.
- Tokens and OAuth PKCE state live only in Keychain; no token enters `UserDefaults`, logs, analytics, fixtures, or exported account data.
- Every database command goes through `scripts/db`; mutations require `--write` and destructive/reset operations require `--write --force`.
- Every commit and PR body ends with `— gib` and contains no AI trailer.

---

## File map

- Database gateway: `scripts/db`, `docs/DATABASE_ACCESS.md`, `AGENTS.md`, `supabase/README.md`.
- Contract: `openapi/workincafe.yaml`, `openapi/fixtures/v1/`, `types/openapi.generated.ts`, `lib/api/v1/`.
- Auth: `lib/supabase/bearer.ts`, `lib/supabase/public.ts`, `lib/auth/request-actor.ts`, `tests/helpers/auth-parity.ts`.
- Routes: `app/api/v1/**/route.ts`, with legacy `/api/**` behavior preserved until shared domain functions are proven.
- Native core: `ios/Packages/WorkInCafeCore/Package.swift`, `Sources/WorkInCafeCore/{API,Auth,Links}/`, `Tests/WorkInCafeCoreTests/`.
- Account lifecycle: `lib/account/`, `app/api/v1/account/`, `app/api/cron/process-account-deletions/route.ts`.

### Task 1: Create the mandatory database gateway before schema work

**Files:**
- Create: `scripts/db`
- Create: `docs/DATABASE_ACCESS.md`
- Create: `tests/db-cli.test.ts`
- Modify: `AGENTS.md`
- Modify: `supabase/README.md`

**Interfaces:**
- Produces: one safe entrypoint for read, write, force, migration replay, local reset, smoke, and type generation.
- Consumes: `~/.config/supabase-cli/accounts.ini`, section `[workincafe]` with `project_ref`, `access_token`, and `db_url`.

- [ ] **Step 1: Write the failing CLI safety test**

```ts
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('scripts/db safety', () => {
  it('rejects mutation SQL without --write before reading credentials', () => {
    const result = spawnSync('scripts/db', ['update users set name = null'], {
      cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, HOME: '/nonexistent' },
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toContain('--write');
    expect(`${result.stdout}${result.stderr}`).not.toContain('sbp_');
  });
});
```

- [ ] **Step 2: Verify the entrypoint is missing**

Run: `npm test -- tests/db-cli.test.ts`

Expected: FAIL with `ENOENT` for `scripts/db`.

- [ ] **Step 3: Implement fail-fast statement classification**

The executable wrapper must classify SQL before reading credentials:

```sh
case "$normalized_sql" in
  insert*|update*|delete*|create*|grant*|revoke*) require_write=1 ;;
  drop*|truncate*|alter*) require_force=1 ;;
esac
```

Reject unscoped `UPDATE`/`DELETE` without `--force`, redact URL passwords and `sbp_` values from every error path, and refuse a credential file whose mode is not `600`.

- [ ] **Step 4: Add owned subcommands and documentation**

Support these exact commands: `self-test`, `local-start`, `local-reset`, `migration-replay`, `local-smoke`, `gen-types`, `-f <file>`, and inline read SQL. The wrapper may call service CLIs internally; humans and agents do not bypass it.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/db-cli.test.ts && scripts/db self-test`

Expected: mutation/force/redaction/mode tests PASS and self-test reports no credential values.

```bash
git add scripts/db docs/DATABASE_ACCESS.md tests/db-cli.test.ts AGENTS.md supabase/README.md
git commit -m "chore: add safe database gateway" -m "— gib"
```

### Task 2: Define and validate the OpenAPI v1 contract

**Files:**
- Create: `openapi/workincafe.yaml`
- Create: `openapi/fixtures/v1/*.json`
- Create: `types/openapi.generated.ts`
- Create: `tests/openapi-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `PlaceSummaryV1`, `PlaceDetailV1`, `CurrentUserV1`, `LocationSampleV1`, `PageV1<T>`, `ApiErrorV1`, and operation IDs used by TypeScript and Swift.
- Consumes: existing category/noise/seating values but exposes no database sentinel values.

- [ ] **Step 1: Install exact contract tooling**

Run: `npm install --save-dev --save-exact @redocly/cli@2.39.0 openapi-typescript@7.13.0 ajv@8.20.0`

Expected: `package-lock.json` records the exact versions.

- [ ] **Step 2: Write the failing fixture-validation test**

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OpenAPI v1 contract', () => {
  it('defines the required native consumer operations', () => {
    const source = readFileSync(join(process.cwd(), 'openapi/workincafe.yaml'), 'utf8');
    for (const operationId of ['listPlaces', 'getPlace', 'getCurrentUser', 'createReview', 'exportAccount', 'deleteAccount']) {
      expect(source).toContain(`operationId: ${operationId}`);
    }
  });
});
```

- [ ] **Step 3: Verify the contract file is missing**

Run: `npm test -- tests/openapi-contract.test.ts`

Expected: FAIL with `ENOENT` for `openapi/workincafe.yaml`.

- [ ] **Step 4: Implement the complete path and schema surface**

Define these exact paths:

```text
GET    /api/v1/places
GET    /api/v1/places/{placeId}
GET    /api/v1/places/{placeId}/reviews
GET    /api/v1/places/{placeId}/menus
GET    /api/v1/search/places
GET    /api/v1/search/locations
GET    /api/v1/config
GET    /api/v1/me
GET    /api/v1/me/favorites
PUT    /api/v1/me/favorites/{placeId}
DELETE /api/v1/me/favorites/{placeId}
POST   /api/v1/reviews
POST   /api/v1/check-ins
POST   /api/v1/live-updates
POST   /api/v1/wifi-samples
POST   /api/v1/decibel-samples
POST   /api/v1/reviews/{reviewId}/photo-uploads
PUT    /api/v1/reviews/{reviewId}/photos/{slot}
GET    /api/v1/account/export
DELETE /api/v1/account
```

Use camelCase, nullable unknown values, cursor pagination, `Idempotency-Key` on harmful duplicate writes, `ETag`/`If-None-Match` on public reads, and this error envelope:

```ts
export interface ApiErrorV1 {
  error: {
    code: 'UNAUTHORIZED' | 'SESSION_EXPIRED' | 'FORBIDDEN' | 'NOT_FOUND' |
      'VALIDATION_FAILED' | 'RATE_LIMITED' | 'GEO_VERIFICATION_FAILED' |
      'FEATURE_DISABLED' | 'CONFLICT' | 'SERVICE_UNAVAILABLE' | 'INTERNAL_ERROR';
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string[]>;
    retryAfterSeconds?: number;
  };
}
```

- [ ] **Step 5: Generate types, validate fixtures, and commit**

Add scripts:

```json
{
  "openapi:lint": "redocly lint openapi/workincafe.yaml",
  "openapi:generate": "openapi-typescript openapi/workincafe.yaml -o types/openapi.generated.ts",
  "openapi:generate:check": "npm run openapi:generate && git diff --exit-code -- types/openapi.generated.ts"
}
```

Run: `npm run openapi:lint && npm run openapi:generate && npm test -- tests/openapi-contract.test.ts`

Expected: lint PASS, all fixtures validate, and generated types are stable.

```bash
git add openapi types/openapi.generated.ts tests/openapi-contract.test.ts package.json package-lock.json
git commit -m "feat: define consumer API contract" -m "— gib"
```

### Task 3: Add bearer-aware request actor precedence

**Files:**
- Create: `lib/supabase/bearer.ts`
- Create: `tests/request-actor-auth.test.ts`
- Modify: `lib/auth/request-actor.ts`
- Modify: `tests/helpers/mock-supabase.ts`

**Interfaces:**
- Produces: `parseBearerAuthorization()`, `createBearerClient()`, and `RequestActorContext`.
- Consumes: `NextRequest`, browser cookie client, and `SupabaseClient<Database>`.

- [ ] **Step 1: Write the precedence regression test**

```ts
it('does not fall back to a valid cookie when a bearer token is invalid', async () => {
  mocks.validateBearer.mockResolvedValue({ user: null, error: { message: 'expired' } });
  mocks.cookieGetUser.mockResolvedValue({ data: { user: USER_A }, error: null });
  const actor = await getRequestActor(request({ authorization: 'Bearer expired-token' }));
  expect(actor.authKind).toBe('bearer');
  expect(actor.authFailure).toBe('expired');
  expect(actor.user).toBeNull();
  expect(mocks.cookieGetUser).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Verify the existing signature/behavior fails**

Run: `npm test -- tests/request-actor-auth.test.ts`

Expected: FAIL because `getRequestActor` is cookie-only and does not expose `authKind`.

- [ ] **Step 3: Implement explicit bearer parsing and client construction**

```ts
export type AuthKind = 'none' | 'cookie' | 'bearer' | 'demo';
export type BearerFailure = 'malformed' | 'invalid' | 'expired';

export function parseBearerAuthorization(value: string | null): { token: string } | { error: 'malformed' } | null {
  if (value === null) return null;
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(value);
  return match ? { token: match[1] } : { error: 'malformed' };
}
```

`createBearerClient(token)` uses the anon key, global `Authorization: Bearer <token>`, disabled session persistence, and `auth.getUser(token)` validation. Distinguish expired JWT errors from other invalid tokens without decoding for authorization.

- [ ] **Step 4: Return one typed context from every path**

```ts
export interface RequestActorContext {
  db: SupabaseClient<Database>;
  supabase: SupabaseClient<Database>;
  user: RequestUser | null;
  isDemo: boolean;
  authKind: AuthKind;
  authFailure: BearerFailure | null;
}
```

Bearer takes precedence, cookie is second, demo is web-only, and absent auth returns the anonymous context.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/request-actor-auth.test.ts tests/request-actor-resolve-place.test.ts`

Expected: cookie, bearer, malformed, expired, missing, and invalid-bearer-plus-cookie cases PASS; service-role creation is never called for bearer requests.

```bash
git add lib/supabase/bearer.ts lib/auth/request-actor.ts tests/request-actor-auth.test.ts tests/helpers/mock-supabase.ts
git commit -m "feat: authenticate native bearer requests" -m "— gib"
```

### Task 4: Implement stable public v1 reads

**Files:**
- Create: `lib/supabase/public.ts`
- Create: `lib/api/v1/http.ts`
- Create: `lib/api/v1/pagination.ts`
- Create: `lib/api/v1/places.ts`
- Create: six public route handlers under `app/api/v1/`
- Create: `tests/api-v1-public-contract.test.ts`

**Interfaces:**
- Produces: `jsonV1()`, `errorV1()`, `parseCursor()`, `listPlaceSummaries()`, and `getPlaceDetail()`.
- Consumes: an anonymous Supabase client for cacheable public reads.

- [ ] **Step 1: Write a failing table-driven contract test**

```ts
const publicCases = [
  { load: () => import('@/app/api/v1/places/route'), url: '/api/v1/places?bbox=2.2,48.8,2.4,48.9' },
  { load: () => import('@/app/api/v1/search/places/route'), url: '/api/v1/search/places?q=cafe' },
] as const;

it.each(publicCases)('returns requestId and contract-valid JSON for $url', async ({ load, url }) => {
  const { GET } = await load();
  const response = await GET(new NextRequest(`http://test.local${url}`));
  expect(response.headers.get('x-request-id')).toMatch(/[0-9a-f-]{36}/);
  expect(validateFixture(url, await response.json())).toBe(true);
});
```

- [ ] **Step 2: Verify the v1 routes are missing**

Run: `npm test -- tests/api-v1-public-contract.test.ts`

Expected: FAIL on the first missing v1 module.

- [ ] **Step 3: Implement anonymous public reads and mapping**

Viewport returns `PlaceSummaryV1` with `isSlim: true`; detail returns `isSlim: false`; rating uses `null`, never zero, for unknown. Public menus explicitly filter `visibility = 'public'`. Reviews use opaque cursor pagination and omit hidden/pending photos.

- [ ] **Step 4: Add cache validators**

Hash the normalized response with SHA-256 into a quoted ETag; return 304 when `If-None-Match` matches. Keep `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` for viewport and shorter/private values where identity can affect content.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/api-v1-public-contract.test.ts && npm run openapi:lint && npm run typecheck`

Expected: 200/304/400/404/503 fixtures PASS and public handlers never construct a cookie or admin client.

```bash
git add app/api/v1 lib/api/v1 lib/supabase/public.ts tests/api-v1-public-contract.test.ts
git commit -m "feat: add stable public consumer API" -m "— gib"
```

### Task 5: Add protected profile/favorites and parity harness

**Files:**
- Create: `app/api/v1/me/route.ts`
- Create: `app/api/v1/me/favorites/route.ts`
- Create: `app/api/v1/me/favorites/[placeId]/route.ts`
- Create: `tests/helpers/auth-parity.ts`
- Create: `tests/api-v1-auth-parity.test.ts`

**Interfaces:**
- Produces: `runAuthParityMatrix()` reusable by every protected operation.
- Consumes: `getRequestActor(request)` and the OpenAPI error envelope.

- [ ] **Step 1: Write the failing parity matrix**

```ts
export const authScenarios = [
  { name: 'cookie A', auth: { kind: 'cookie', user: USER_A }, status: 200 },
  { name: 'bearer A', auth: { kind: 'bearer', user: USER_A }, status: 200 },
  { name: 'expired bearer', auth: { kind: 'bearer', failure: 'expired' }, status: 401 },
  { name: 'missing auth', auth: { kind: 'none' }, status: 401 },
  { name: 'bearer B accessing A resource', auth: { kind: 'bearer', user: USER_B }, status: 404 },
] as const;
```

Each assertion normalizes request IDs/timestamps before comparing cookie/bearer bodies and verifies the database user ID comes only from the actor.

- [ ] **Step 2: Verify missing v1 protected routes fail**

Run: `npm test -- tests/api-v1-auth-parity.test.ts`

Expected: FAIL on a missing v1 route import.

- [ ] **Step 3: Implement explicit protected semantics**

`GET /me` returns 401 when signed out, plus user ID, display name, email, and provider list when signed in. Favorites uses `GET /me/favorites`, idempotent `PUT /me/favorites/{placeId}`, and idempotent `DELETE`; payloads never accept `userId`.

- [ ] **Step 4: Prove parity and isolation**

Spy that `createAdminClient()` is unused; user B cannot mutate or list user A's collection; expired bearer returns `WWW-Authenticate` and does not write.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/api-v1-auth-parity.test.ts tests/api-me-route.test.ts tests/favorites-route.test.ts`

Expected: all scenarios PASS and legacy routes remain green.

```bash
git add app/api/v1/me tests/helpers/auth-parity.ts tests/api-v1-auth-parity.test.ts
git commit -m "feat: add authenticated consumer profile API" -m "— gib"
```

### Task 6: Contract writes with idempotency and 150-meter geo enforcement

**Files:**
- Create: `lib/api/v1/submissions.ts`
- Create: five write route handlers under `app/api/v1/`
- Create: route tests per operation under `tests/api-v1-*-route.test.ts`
- Create: CLI-generated Supabase migration for idempotency/geo RPCs
- Modify: `app/api/_shared/geo-check.ts`

**Interfaces:**
- Produces: `assertFreshLocation(sample, now)`, `requireIdempotencyKey(request)`, and user-scoped RPC calls.
- Consumes: `LocationSampleV1`, actor user ID, and database-enforced uniqueness.

- [ ] **Step 1: Write the failing location-policy test**

```ts
it('rejects a stale or inaccurate sample before a write', () => {
  const now = new Date('2026-07-15T10:00:00Z');
  expect(() => assertFreshLocation({ latitude: 48.8, longitude: 2.3, horizontalAccuracyMeters: 250, capturedAt: '2026-07-15T09:59:55Z' }, now))
    .toThrow('horizontal accuracy exceeds 150 meters');
  expect(() => assertFreshLocation({ latitude: 48.8, longitude: 2.3, horizontalAccuracyMeters: 20, capturedAt: '2026-07-15T09:50:00Z' }, now))
    .toThrow('location sample is stale');
});
```

- [ ] **Step 2: Verify the submissions module is missing**

Run: `npm test -- tests/api-v1-reviews-route.test.ts`

Expected: FAIL because `lib/api/v1/submissions.ts` does not exist.

- [ ] **Step 3: Implement route-level validation and idempotency**

Require a UUID `Idempotency-Key`, a sample no older than 120 seconds, horizontal accuracy at most 150 meters, and server distance at most 150 meters. Ignore any payload `userId` or `geoVerified`; derive both server-side.

- [ ] **Step 4: Generate and test database enforcement through `scripts/db`**

Run: `scripts/db migration-new consumer_write_idempotency`

In the generated migration, add idempotency storage and SECURITY DEFINER RPCs that verify `auth.uid()`, ban state, distance, and uniqueness. Apply only through `scripts/db migration-replay --write --force`; add HTTP/RLS smoke tests that prove direct PostgREST cannot forge geo flags.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/api-v1-reviews-route.test.ts tests/api-v1-check-ins-route.test.ts tests/api-v1-live-updates-route.test.ts tests/api-v1-wifi-samples-route.test.ts tests/api-v1-decibel-samples-route.test.ts && scripts/db local-smoke`

Expected: route, duplicate-key, stale-location, accuracy, distance, banned-user, and RLS-forgery cases PASS.

```bash
git add lib/api/v1/submissions.ts app/api/v1 supabase/migrations tests
git commit -m "feat: secure consumer submission API" -m "— gib"
```

### Task 7: Add universal links and buildable native auth core

**Files:**
- Create: `app/.well-known/apple-app-site-association/route.ts`
- Create: `app/auth/native/callback/page.tsx`
- Create: `app/recover/[kind]/[placeId]/page.tsx`
- Create: `lib/auth/redirects.ts`
- Create: `tests/apple-app-site-association-route.test.ts`
- Create: `tests/auth-callback-route.test.ts`
- Create: `tests/recovery-link-route.test.ts`
- Create: `ios/Packages/WorkInCafeCore/Package.swift`
- Create: `ios/Packages/WorkInCafeCore/Sources/WorkInCafeCore/{API,Auth,Links}/`
- Create: `ios/Packages/WorkInCafeCore/Tests/WorkInCafeCoreTests/`
- Modify: `app/auth/callback/route.ts`

**Interfaces:**
- Produces: AASA routes for `/place/*`, `/auth/native/callback`, and `/recover/*/*`.
- Produces: `NativeSession`, `AuthSessionStore`, `BearerTokenProviding`, `NativeAuthClient`, and `UniversalLinkRouter`.

- [ ] **Step 1: Write failing AASA and redirect-safety tests**

```ts
it('serves AASA as JSON without redirect and only approved paths', async () => {
  const { GET } = await import('@/app/.well-known/apple-app-site-association/route');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toMatchObject({ applinks: { details: [{ components: [
    { '/': '/place/*' }, { '/': '/auth/native/callback' }, { '/': '/recover/*/*' },
  ] }] } });
});
```

- [ ] **Step 2: Verify the AASA route is missing**

Run: `npm test -- tests/apple-app-site-association-route.test.ts`

Expected: FAIL on the missing route import.

- [ ] **Step 3: Implement web link artifacts and safe callback separation**

Serve AASA without redirects. The Team ID is read from required production env `APPLE_TEAM_ID` and output as `${APPLE_TEAM_ID}.cafe.workin.app`. Browser callback exchanges browser codes only; native callback never logs/displays codes and hands control to the associated app with a non-secret state token.

- [ ] **Step 4: Create the exact-pinned Swift package and generated client**

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "WorkInCafeCore",
    platforms: [.iOS(.v18), .macOS(.v15)],
    products: [.library(name: "WorkInCafeCore", targets: ["WorkInCafeCore"])],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", exact: "1.13.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", exact: "1.12.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", exact: "1.3.1"),
    ],
    targets: [
        .target(name: "WorkInCafeCore", dependencies: [
            .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
            .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
        ], plugins: [.plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator")]),
        .testTarget(name: "WorkInCafeCoreTests", dependencies: ["WorkInCafeCore"]),
    ]
)
```

Copy the contract into the target resources and add `openapi-generator-config.yaml` with `generate: [types, client]`.

- [ ] **Step 5: Test Keychain, nonce, refresh, and cold-launch links**

```swift
public struct NativeSession: Codable, Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String
    public let expiresAt: Date
    public let userID: UUID
    public let provider: AuthProvider
}

public enum AuthProvider: String, Codable, Hashable, Sendable {
    case apple
    case google
}

public protocol AuthSessionStore: Sendable {
    func load() async throws -> NativeSession?
    func save(_ session: NativeSession) async throws
    func clear() async throws
}

public protocol BearerTokenProviding: Sendable {
    func validAccessToken() async throws -> String?
}

public struct OAuthAuthorizationRequest: Sendable, Equatable {
    public let provider: AuthProvider
    public let authorizationURL: URL
    public let callbackURL: URL
    public let state: String
}

public protocol NativeAuthClient: Sendable {
    func authorizationRequest(provider: AuthProvider, callbackURL: URL) async throws -> OAuthAuthorizationRequest
    func exchange(callbackURL: URL, expectedState: String) async throws -> NativeSession
    func refresh(_ session: NativeSession) async throws -> NativeSession
    func signOut(_ session: NativeSession) async throws
}

public enum RecoveryKind: String, Codable, Sendable {
    case review
    case checkIn = "check-in"
    case liveUpdate = "live-update"
}

public enum AppLink: Sendable, Equatable {
    case place(UUID)
    case authCallback(URL)
    case recover(kind: RecoveryKind, placeID: UUID)
}

public protocol UniversalLinkRouting: Sendable {
    func route(_ url: URL) -> AppLink?
}
```

`UniversalLinkRouter` implements `UniversalLinkRouting`; reject non-HTTPS URLs, hosts other than `workin.cafe`, unknown paths, malformed UUIDs, and callbacks whose state does not match the Keychain value. Persist tokens, OAuth state, PKCE verifier, and pending destination only through Keychain. Run: `swift test --package-path ios/Packages/WorkInCafeCore`.

Expected: generated client compiles and session/link tests PASS.

```bash
git add app/.well-known app/auth/native app/recover lib/auth/redirects.ts app/auth/callback/route.ts tests ios/Packages/WorkInCafeCore
git commit -m "feat: add native auth and universal link core" -m "— gib"
```

### Task 8: Add default-off photo preparation/completion contracts

**Files:**
- Create: `app/api/v1/config/route.ts`
- Create: `lib/release/flags.ts`
- Create: `app/api/v1/reviews/[reviewId]/photo-uploads/route.ts`
- Create: `app/api/v1/reviews/[reviewId]/photos/[slot]/route.ts`
- Create: `tests/api-v1-photo-gate.test.ts`

**Interfaces:**
- Produces: `getPublicReleaseConfig(): Promise<{ publicReviewPhotosEnabled: boolean }>`.
- Consumes: existing Cloudinary ownership checks, but returns `FEATURE_DISABLED` by default.

- [ ] **Step 1: Write the fail-closed test**

```ts
it('disables public photos when the release flag cannot be read', async () => {
  mocks.readReleaseFlag.mockRejectedValue(new Error('database unavailable'));
  await expect(getPublicReleaseConfig()).resolves.toEqual({ publicReviewPhotosEnabled: false });
  const response = await preparePhotoUpload(requestFor(USER_A));
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe('FEATURE_DISABLED');
});
```

- [ ] **Step 2: Verify the release module is missing**

Run: `npm test -- tests/api-v1-photo-gate.test.ts`

Expected: FAIL because `lib/release/flags.ts` does not exist.

- [ ] **Step 3: Implement three-layer gating**

Gate picker visibility via `/api/v1/config`, signature issuance, completion, and public response serialization. Missing flag/table/error always yields `false`. Validate review-folder identity, MIME, byte size, checksum, ownership, slot, and idempotent completion.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/api-v1-photo-gate.test.ts tests/cloudinary-sign-route.test.ts tests/review-photos-route.test.ts`

Expected: default/error/disabled states never issue signatures or serialize photos; enabled ownership cases PASS.

```bash
git add app/api/v1/config app/api/v1/reviews lib/release tests/api-v1-photo-gate.test.ts
git commit -m "feat: gate native review photos" -m "— gib"
```

### Task 9: Implement contracted account export

**Files:**
- Create: `lib/account/export-account.ts`
- Create: `app/api/v1/account/export/route.ts`
- Create: `tests/account-export-route.test.ts`

**Interfaces:**
- Produces: `buildAccountExport(actor): Promise<AccountExportV1>`.
- Consumes: user-scoped clients and every user-owned table; never auth tokens or internal security fields.

- [ ] **Step 1: Write the failing isolation test**

```ts
it('exports only the authenticated user and excludes credentials', async () => {
  const response = await GET(bearerRequest(USER_B));
  const body = await response.json();
  expect(body.account.id).toBe(USER_B.id);
  expect(JSON.stringify(body)).not.toMatch(/accessToken|refreshToken|serviceRole|password/i);
  expect(body.reviews.every((row: { userId: string }) => row.userId === USER_B.id)).toBe(true);
  expect(response.headers.get('cache-control')).toBe('no-store');
});
```

- [ ] **Step 2: Verify the route is missing**

Run: `npm test -- tests/account-export-route.test.ts`

Expected: FAIL on the missing export route.

- [ ] **Step 3: Implement a versioned attachment**

Export account/provider metadata, favorites, reviews/photos, check-ins, live/Wi-Fi/decibel samples, place requests, reports, friend profile, claims/ownership, purchases, and loyalty events where owned. Return `Content-Disposition: attachment; filename="workincafe-account-<date>.json"` and `Cache-Control: no-store`.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/account-export-route.test.ts tests/api-v1-auth-parity.test.ts`

Expected: all owned categories appear, other-user records and secrets do not.

```bash
git add lib/account/export-account.ts app/api/v1/account/export/route.ts tests/account-export-route.test.ts
git commit -m "feat: export consumer account data" -m "— gib"
```

### Task 10: Implement idempotent account deletion and Apple revocation

**Files:**
- Create: `lib/account/delete-account.ts`
- Create: `lib/auth/apple-token-revocation.ts`
- Create: `app/api/v1/account/route.ts`
- Create: `app/api/cron/process-account-deletions/route.ts`
- Create: CLI-generated account lifecycle migration
- Create: `tests/account-delete-route.test.ts`
- Create: `tests/apple-token-revocation.test.ts`
- Create: `tests/account-deletion-cron.test.ts`
- Create: `components/profile/AccountActions.tsx`
- Modify: `components/profile/ProfileBody.tsx`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `requestAccountDeletion()`, `processAccountDeletionJob()`, and `revokeAppleAuthorizationCode()`.
- Consumes: a fresh Apple authorization code when the account has Apple identity.

- [ ] **Step 1: Write the failing state-machine test**

```ts
it('suppresses content, revokes Apple, cleans assets, then deletes auth exactly once', async () => {
  await requestAccountDeletion({ actor: USER_A, appleAuthorizationCode: 'fresh-code' });
  await processAccountDeletionJob(USER_A.id);
  await processAccountDeletionJob(USER_A.id);
  expect(mocks.suppressContent).toHaveBeenCalledOnce();
  expect(mocks.revokeApple).toHaveBeenCalledOnce();
  expect(mocks.deleteCloudinary).toHaveBeenCalledOnce();
  expect(mocks.deleteAuthUser).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Verify the lifecycle modules are missing**

Run: `npm test -- tests/account-delete-route.test.ts tests/apple-token-revocation.test.ts`

Expected: FAIL on missing modules.

- [ ] **Step 3: Generate account lifecycle schema through the gateway**

Run: `scripts/db migration-new account_lifecycle`

The generated migration adds idempotent states `requested`, `content_suppressed`, `providers_revoked`, `assets_deleted`, `database_cleaned`, `auth_deleted`, and `failed_retryable`, with attempt count and redacted error code. Resolve attribution foreign keys with `ON DELETE SET NULL` or explicit anonymization; preserve legally required financial rows without retaining profile identity.

- [ ] **Step 4: Implement safe provider and external cleanup order**

For Apple identities, require fresh native reauthorization, exchange the authorization code server-side, revoke immediately, and never persist the returned Apple token. If exchange/revocation is unavailable, return `503 SERVICE_UNAVAILABLE` before starting deletion. After suppression, delete Cloudinary/claim assets, disconnect Stripe ownership state, anonymize retained records, delete user-owned rows, then call Supabase Auth admin deletion. The cron retries only jobs already past provider revocation.

- [ ] **Step 5: Add web controls and verify retry behavior**

`AccountActions` offers export and destructive deletion confirmation. Test partial Cloudinary/Stripe failures, repeated DELETE, cron retry, another user's token, and completed-job idempotency.

Run: `npm test -- tests/account-delete-route.test.ts tests/apple-token-revocation.test.ts tests/account-deletion-cron.test.ts && scripts/db local-smoke && npm run build`

Expected: all state transitions PASS, failures resume from the recorded state, and only lifecycle code constructs the admin client.

```bash
git add lib/account lib/auth/apple-token-revocation.ts app/api/v1/account app/api/cron/process-account-deletions components/profile supabase/migrations tests vercel.json
git commit -m "feat: delete accounts with provider cleanup" -m "— gib"
```

## Milestone completion gate

Run:

```bash
npm run openapi:lint
npm run openapi:generate:check
npm run lint
npm run typecheck
npm test
npm run build
swift test --package-path ios/Packages/WorkInCafeCore
scripts/db migration-replay --write --force
scripts/db local-smoke
```

Expected: all commands PASS; cookie/bearer parity is green; direct RLS forgery fails; generated TypeScript/Swift clients are reproducible; AASA returns 200 without redirect; export/deletion acceptance is complete.

Open the PR with `Closes #301`, the auth matrix, migration evidence, generated-client diff, universal-link cold-launch evidence, and account lifecycle retry evidence. Self-review the GitHub diff before merge.
