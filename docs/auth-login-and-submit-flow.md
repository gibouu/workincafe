# Login With Apple/Google and Submit-Time Auth Plan

## Goal

Enable Google and Apple login through Supabase Auth, and allow users to draft reviews, live updates, and check-ins while signed out. Signing in should only be required when the user submits.

## Current State

- The app already uses Supabase Auth.
- `/auth` already has Google and Apple buttons.
- `/auth/callback` exchanges the OAuth code for a Supabase session.
- Middleware currently protects `/profile`, `/review/new`, and `/admin`.
- Write APIs already require an authenticated Supabase user:
  - `/api/reviews`
  - `/api/live-updates`
  - `/api/checkins`

## Supabase Setup

In Supabase Dashboard -> Authentication -> Providers:

### Google

Enable Google and add:

- Google OAuth Client ID
- Google OAuth Client Secret

### Apple

Enable Apple and add:

- Apple Services ID
- Apple Team ID
- Apple Key ID
- Apple `.p8` private key contents

OAuth provider secrets should live in Supabase, not in the Next.js app env, when using hosted Supabase Auth.

## Google Cloud Setup

Create a Google OAuth Web Application client.

Authorized JavaScript origins:

- `http://localhost:3000`
- `https://workin.cafe`
- Vercel preview origin if preview auth testing is needed

Authorized redirect URI:

- Supabase callback URL from the Supabase Google provider page, usually:
  - `https://<project-ref>.supabase.co/auth/v1/callback`

## Apple Developer Setup

Create or confirm an App ID with Sign in with Apple enabled.

Create a Services ID for the website, for example:

- `cafe.workin.web`

Configure Website URLs:

- Domain:
  - `workin.cafe`
- Return URL:
  - `https://<project-ref>.supabase.co/auth/v1/callback`

Create an Apple key with Sign in with Apple enabled and save:

- `.p8` private key
- Key ID
- Team ID
- Services ID

## Supabase Redirect URLs

In Supabase Dashboard -> Authentication -> URL Configuration:

Site URL:

- `https://workin.cafe`

Redirect allow list:

- `http://localhost:3000/auth/callback`
- `https://workin.cafe/auth/callback`
- Optional Vercel preview callback pattern

## App Changes To Implement Later

### Preserve `next` During OAuth

Update `/auth` so it reads `?next=/target-path` and passes it into:

`/auth/callback?next=/target-path`

The OAuth call should keep using Supabase:

```ts
supabase.auth.signInWithOAuth({
  provider,
  options: {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
  },
});
```

### Harden `/auth/callback`

Update `/auth/callback` so:

- `next` must be a relative path.
- External URLs are rejected.
- Invalid `next` falls back to `/`.
- Production redirects respect forwarded host headers.

### Middleware

Remove `/review/new` from protected middleware routes.

Keep protected:

- `/profile`
- `/admin`

Reviews should be accessible signed out, but submission should require auth.

### Reviews

Allow signed-out users to fill the review form.

On submit:

1. Try to submit normally.
2. If unauthenticated or API returns `401`:
   - Save the draft review payload in `localStorage`.
   - Redirect to `/auth?next=/review/new/[placeId]?submit=review`.
3. After login:
   - Restore draft from `localStorage`.
   - Submit automatically once.
   - Clear the saved draft after success.

### Live Updates

Allow signed-out users to fill the live update drawer.

On submit:

1. Try to submit normally.
2. If unauthenticated or API returns `401`:
   - Save the pending live update in `localStorage`.
   - Redirect to `/auth?next=<current-page>?submit=live-update`.
3. After login:
   - Replay the pending update.
   - Clear the saved update after success.

### Check-ins

Do not show success before the API succeeds.

On signed-out submit:

1. Get geolocation.
2. Save pending check-in intent in `localStorage`.
3. Redirect to login.
4. Submit after auth returns.
5. Show success only after API success.

## API Behavior

Keep write APIs authenticated.

Do not allow anonymous database writes for:

- reviews
- live updates
- check-ins

RLS policies should remain tied to `auth.uid()`.

## Testing Checklist

- Google login works locally.
- Apple login works in production.
- OAuth returns to the intended `next` path.
- External `next` URLs are rejected.
- Signed-out users can fill a review.
- Signed-out review submit redirects to login and then submits preserved data.
- Signed-out live update follows the same flow.
- Signed-out check-in follows the same flow.
- Signed-in users submit without redirect.
- `localStorage` drafts are cleared after success.
- Run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
