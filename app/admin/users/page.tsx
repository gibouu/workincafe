import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { AdminUserSearch } from '@/components/admin/AdminUserSearch';

interface AuthUserLite {
  id: string;
  email: string | null;
}

interface AdminRow {
  id: string;
  display_name: string | null;
  email: string | null;
}

async function loadAdmins(currentUserId: string | null): Promise<{
  admins: AdminRow[];
  selfId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { admins: [], selfId: null };
  if (!isEmailAllowlisted(user.email)) return { admins: [], selfId: user.id };

  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return { admins: [], selfId: user.id };

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('users')
    .select('id, display_name')
    .eq('is_admin', true)
    .order('display_name', { ascending: true });

  if (!rows || rows.length === 0) return { admins: [], selfId: user.id };

  const ids = rows.map((r) => r.id);
  // Pull emails from auth.users (admin client only)
  const { data: authResp } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = new Map<string, string | null>();
  for (const u of (authResp?.users ?? []) as AuthUserLite[]) emailById.set(u.id, u.email ?? null);

  const admins: AdminRow[] = rows.map((r) => ({
    id: r.id,
    display_name: (r as { display_name: string | null }).display_name ?? null,
    email: emailById.get(r.id) ?? null,
  }));
  return { admins, selfId: currentUserId };
}

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { admins, selfId } = await loadAdmins(user?.id ?? null);

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Admins</div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[var(--text-primary)]">
          Admins ({admins.length})
        </h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          Promote anyone signed up via OAuth to admin. They&apos;ll get access to
          moderation queues + ownership claims.
        </p>

        <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Current admins
        </h2>
        {admins.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-[var(--surface-border)] bg-white p-5 text-center text-[13px] text-[var(--text-secondary)] shadow-card">
            No admins yet. The first user to sign in becomes admin
            automatically (per migration 009).
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {admins.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
                  <Icon name="UserCircle" size={22} weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                    {a.display_name ?? a.email ?? 'Unnamed admin'}
                    {a.id === selfId && (
                      <span className="ml-2 rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                        You
                      </span>
                    )}
                  </div>
                  {a.email && (
                    <div className="truncate text-[12px] text-[var(--text-secondary)]">
                      {a.email}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-8 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
          Promote a user
        </h2>
        <div className="mt-2">
          <AdminUserSearch
            selfId={selfId}
            adminCount={admins.length}
          />
        </div>
      </div>
    </div>
  );
}
