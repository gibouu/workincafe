# Security policy

## Reporting a vulnerability

If you've found a security issue in Work in Café, please **do not open a public GitHub issue**. Instead, use GitHub's private vulnerability reporting flow:

👉 **[Report a vulnerability](https://github.com/gibouu/workincafe/security/advisories/new)**

This routes the report straight to the maintainer and keeps the details private until a fix is shipped.

## What to include

- A clear description of the issue and where it lives (file path, route, or feature).
- Steps to reproduce — ideally a minimal repro against a fresh `npm run dev`.
- Impact: what an attacker could do with this.
- Any suggested fix or mitigation, if you have one.

## What to expect

- **Acknowledgement** within a few days.
- **A fix** for confirmed issues as quickly as the severity warrants. High-severity issues get priority over feature work.
- **Credit** in the release notes if you'd like (and you tell us how you'd like to be credited).

## Scope

In-scope:
- The `workin.cafe` web app (Next.js routes under `app/`, API routes under `app/api/`).
- The Supabase schema and RLS policies under `supabase/migrations/`.
- Any client-side measurement code (`lib/measurement/`) that touches user device sensors.

Out of scope:
- Findings in third-party services we use (Supabase, Vercel, Cloudinary, OpenFreeMap) — please report those directly to the vendor.
- Self-XSS, denial of service via excessive request volume, or anything that requires the user to actively cooperate against their own interest.
- Missing security headers without a demonstrated impact.
