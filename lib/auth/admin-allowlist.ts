/**
 * Belt-and-suspenders gate for the admin surface.
 *
 * The primary admin check is the `is_admin` column on `public.users`. This
 * helper layers a second factor on top: an email allowlist set via the
 * `ADMIN_EMAIL_ALLOWLIST` env var (comma-separated list of emails). When
 * the allowlist is non-empty, only those emails get admin access — even
 * if `is_admin = true` somehow gets set on another row (manual SQL slip,
 * RLS hole, bug). When the env var is unset, behaviour is unchanged so
 * local dev works the same as before.
 *
 * Used by:
 *   - middleware.ts (gate `/admin/*` paths)
 *   - admin API routes (defence-in-depth in case middleware misconfigured)
 *   - admin server components (same)
 */

let cached: { raw: string; list: string[] } | null = null;

function readAllowlist(): string[] {
  const raw = (process.env.ADMIN_EMAIL_ALLOWLIST ?? '').trim();
  if (cached && cached.raw === raw) return cached.list;
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  cached = { raw, list };
  return list;
}

export function adminAllowlistEnabled(): boolean {
  return readAllowlist().length > 0;
}

/**
 * Returns true when:
 *   - the allowlist is empty/unset (no extra restriction), OR
 *   - the email matches an entry in the allowlist (case-insensitive).
 *
 * Returns false when the allowlist is set but the email is missing or
 * not on the list.
 */
export function isEmailAllowlisted(email: string | null | undefined): boolean {
  const list = readAllowlist();
  if (list.length === 0) return true;
  if (!email) return false;
  return list.includes(email.toLowerCase());
}
