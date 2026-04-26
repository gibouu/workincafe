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

### Apple Developer

1. **App ID** with Sign in with Apple enabled (or confirm an existing one).
2. **Services ID** for the website, e.g. `cafe.workin.web`. Configure Website URLs:
   - **Domain**: `workin.cafe`
   - **Return URL**: the Supabase callback URL
     `https://<project-ref>.supabase.co/auth/v1/callback`
3. **Key** with Sign in with Apple enabled. Download the `.p8` file. Record the **Key ID** and the **Team ID**.

### Supabase Dashboard

Authentication → Providers → Apple:

- Toggle **Enabled**.
- Paste **Services ID**, **Team ID**, **Key ID**, and the entire contents of the `.p8` file.
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
