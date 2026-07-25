> **ARCHIVED — historical record only.** This document describes the
> pre-reconstruction application preserved at tag
> `archive/pre-reconstruction-2026-07-21`. It is not instructions and has no
> authority. Superseded by: docs/decisions/source/04-authentication.md (Supabase not part of the approved stack; see source/02, Decision 5). See `docs/RECONSTRUCTION.md`.

# Supabase Auth setup runbook

Operator runbook for enabling Google + Apple sign-in. The app code is already wired — completing this once flips it on. Sister doc: [`docs/auth-login-and-submit-flow.md`](auth-login-and-submit-flow.md) (rationale + flow design).

## What's already done in code

- `app/auth/page.tsx` — Google + Apple buttons; preserves `?next=` in the OAuth `redirectTo`.
- `app/auth/callback/route.ts` — exchanges the OAuth code for a Supabase session; validates `next` is a relative path before redirecting.
- `middleware.ts` — protects `/profile` and `/admin` only. `/review/new` is intentionally open; auth is enforced at submit time via 401 → draft save → redirect → replay.

## Step 1 — Supabase URL configuration

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://workin.cafe`
- **Redirect allow list** (add all):
  - `http://localhost:3000/auth/callback`
  - `https://workin.cafe/auth/callback`
  - (optional) Vercel preview pattern, e.g. `https://*.vercel.app/auth/callback`

## Step 2 — Google provider

### Google Cloud Console

Create an OAuth 2.0 Client ID (Web application).

- **Authorized JavaScript origins**:
  - `http://localhost:3000`
  - `https://workin.cafe`
  - (optional) preview origin
- **Authorized redirect URI**: copy from Supabase Dashboard → Authentication → Providers → Google. It looks like:
  - `https://<project-ref>.supabase.co/auth/v1/callback`

Save the Client ID and Client Secret.

### Supabase Dashboard

Authentication → Providers → Google:

- Toggle **Enabled**.
- Paste the **Client ID** and **Client Secret**.
- Save.

## Step 3 — Apple provider

> **About the MapKit Apple keys you already have.** `APPLE_TEAM_ID` is the same Team ID. `APPLE_KEY_ID` + `APPLE_MAPKIT_PRIVATE_KEY` (`.p8`) **can** be reused for Sign in with Apple **only if** the original Key was created with both "MapKit JS" and "Sign in with Apple" capabilities checked. Most teams ship one capability per key — if the existing key is MapKit-only, generate a NEW Sign in with Apple key. Either way, you also need a fresh **Services ID** (separate from the App ID and from MapKit), because Sign in with Apple uses Services IDs as the OAuth client ID.

### Apple Developer

1. **App ID** — Identifiers → App IDs → confirm an App ID exists with the "Sign in with Apple" capability enabled.
2. **Services ID** — Identifiers → Services IDs → New (this is the OAuth client ID).
   - Identifier: e.g. `cafe.workin.web`
   - Description: "Work in Cafe Web"
   - Configure → enable **Sign in with Apple**
   - Domains: `workin.cafe` (and `localhost` for dev — Apple accepts it)
   - **Return URL**: the Supabase callback `https://<project-ref>.supabase.co/auth/v1/callback`
   - Save.
3. **Key** — Identifiers → Keys.
   - **If your MapKit key has Sign-in-with-Apple checked**: reuse it.
   - **Otherwise**: New Key → enable Sign in with Apple → Continue → download `.p8`.
   - Record the **Key ID** and your **Team ID** (top-right of the Apple Developer console).

### Supabase Dashboard

Authentication → Providers → Apple:

- Toggle **Enabled**.
- **Client ID (Services ID)** = `cafe.workin.web` (the Services ID from step 2 — NOT the App ID).
- **Team ID** = your Apple Team ID.
- **Key ID** = the Sign-in-with-Apple key's ID.
- **Secret Key** = the entire contents of the `.p8` file (start with `-----BEGIN PRIVATE KEY-----`, end with `-----END PRIVATE KEY-----`).
- Save.

## Step 4 — App env

Already required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

OAuth provider secrets live **in Supabase**, not in app env. Do not put Google/Apple secrets in `.env.local`.

## Step 5 — Test

1. `npm run dev` and open `http://localhost:3000`.
2. Trigger a sign-in (e.g., open the `Profile` link in the desktop nav). You should bounce to `/auth`.
3. Click **Continue with Google** (or Apple). Provider page → Supabase → `/auth/callback` → back to the page you started from.
4. Try a signed-out submit on a place card's **Live review** chip:
   - You should land at `/auth?next=/?submit=checkin`.
   - After OAuth, you should land back on `/` and see a "Live review posted" toast within ~1 s.
   - `localStorage["wic:pending:checkin"]` should be cleared.
5. Try `?next=https://evil.com` on `/auth/callback` directly — you should be redirected to `/`.
6. **First user becomes admin automatically** (per `supabase/migrations/009_admin_bootstrap.sql`). After your very first sign-in, run `select id, is_admin from public.users where id = auth.uid();` in SQL Editor and you should see `is_admin = true`. From there, visit `/admin/users` to grant admin to others by email.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `provider not enabled` from Supabase | Provider toggle off in Supabase Dashboard |
| Redirect loops between `/auth` and `/auth/callback` | Site URL or redirect allow list mismatch |
| `invalid_grant` after Apple sign-in | `.p8` content was truncated, or Key/Team/Services ID mismatch |
| `?next=` ignored after sign-in | The OAuth `redirectTo` must include `next` — confirm `app/auth/page.tsx` is sending it |
| 401 after sign-in | Supabase session cookie not set; check that Vercel/origin matches the Site URL |

## What's intentionally not in this runbook

- Email/password and magic-link sign-in. Decision D6 in the build spec: Google + Apple only. **Don't add them.**
- RLS policy review. The existing migrations already tie reviews/live-updates/check-ins to `auth.uid()`.
- Anonymous writes. We don't allow them; `submit-time auth` is the deliberate alternative.
