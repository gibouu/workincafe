import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;
type AuthUserLite = { id: string; email: string | null };

export async function findAuthUserByEmail(
  admin: AdminClient,
  email: string,
): Promise<AuthUserLite | null> {
  const normalizedEmail = email.toLowerCase();
  const perPage = 100;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = (data.users ?? []) as AuthUserLite[];
    const user = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (user) return user;
    if (users.length < perPage) return null;
  }
}

export async function getAuthEmailsByUserId(
  admin: AdminClient,
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const emailByUser = new Map<string, string>();
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

  await Promise.all(
    uniqueIds.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) return;
      const email = data.user?.email;
      if (email) emailByUser.set(id, email);
    }),
  );

  return emailByUser;
}
