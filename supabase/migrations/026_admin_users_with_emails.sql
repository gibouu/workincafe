-- Migration 026 — admin_users_with_emails() RPC.
--
-- The /admin/users page was relying on supabase.auth.admin.listUsers() to
-- map admin ids to emails. That API silently dropped emails for several
-- admin rows in production, leaving the panel showing only display names.
-- (Likely a Supabase auth SDK quirk — listUsers paginates, can return
-- empty email strings for OAuth identity-only accounts in some cases.)
--
-- Replace with a SECURITY DEFINER function that joins public.users with
-- auth.users directly. Service-role-callable; bypasses RLS by design.
-- Returns rows ordered by email so the panel render is stable.

set search_path = public, extensions;

create or replace function public.admin_users_with_emails()
returns table (
  id uuid,
  display_name text,
  email text
)
language sql
security definer
set search_path = public, auth
as $$
  select u.id, u.display_name, au.email::text
  from public.users u
  join auth.users au on au.id = u.id
  where u.is_admin = true
  order by au.email;
$$;

comment on function public.admin_users_with_emails is
  'Returns admin users with their auth.users email. Bypasses the auth admin SDK which dropped emails for OAuth-only accounts. See #163.';

-- Grant execute to the service role only — page calls via admin client.
revoke all on function public.admin_users_with_emails from public, anon, authenticated;
grant execute on function public.admin_users_with_emails to service_role;
