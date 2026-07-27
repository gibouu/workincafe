# Security policy

## Reporting a vulnerability

Please **do not open a public GitHub issue** for security problems. Use GitHub's private
vulnerability reporting flow:

👉 **[Report a vulnerability](https://github.com/gibouu/workincafe/security/advisories/new)**

Include: a clear description and location (file/route/feature), steps to reproduce, the
impact, and any suggested fix. Expect acknowledgement within a few days and a fix
prioritized by severity.

## Scope

This repository is under reconstruction; the application surface is being rebuilt. Scope
tracks the current tree:

**In scope**

- The Next.js application under `app/` and its Route Handlers under `app/api/`.
- The data-access, auth, and provider-integration code under `lib/` as it lands.
- Database schema and migrations under `drizzle/` once the baseline exists.
- The compliance-bearing boundaries recorded in `docs/testing/obligations.md` (e.g.
  Google-content persistence and attribution rules).

**Out of scope**

- Third-party services (Vercel, Neon, Google Maps Platform) — report to the vendor.
- Self-XSS, denial of service via request volume, or missing headers without demonstrated
  impact.
- The archived legacy implementation (tag `archive/pre-reconstruction-2026-07-21`), which
  is not deployed.
