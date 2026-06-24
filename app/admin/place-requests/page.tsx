import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { getAuthEmailsByUserId } from '@/lib/auth/admin-users';
import { type PlaceRequestRecord } from '@/components/admin/PlaceRequestRow';
import { PlaceRequestsQueue } from '@/components/admin/PlaceRequestsQueue';

async function loadRequests(): Promise<PlaceRequestRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (!isEmailAllowlisted(user.email)) return [];

  const { data: me } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (!me?.is_admin) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('place_requests')
    .select('id, name, lat, lng, address, category_suggestion, notes, created_at, submitted_by')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data || data.length === 0) return [];

  const submitterIds = [...new Set(data.map((r) => r.submitted_by as string))];
  const emailById = await getAuthEmailsByUserId(admin, submitterIds);

  // Submitter trust signal (#167): each submitter's historical approved /
  // decided ratio. One bounded query over only the submitters in this queue.
  const statsById = new Map<string, { approved: number; decided: number }>();
  if (submitterIds.length > 0) {
    const { data: hist } = await admin
      .from('place_requests')
      .select('submitted_by, status')
      .in('submitted_by', submitterIds)
      .neq('status', 'pending');
    for (const row of hist ?? []) {
      const sid = row.submitted_by as string;
      const s = statsById.get(sid) ?? { approved: 0, decided: 0 };
      s.decided += 1;
      if (row.status === 'approved') s.approved += 1;
      statsById.set(sid, s);
    }
  }

  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    lat: r.lat as number,
    lng: r.lng as number,
    address: (r.address as string | null) ?? null,
    category_suggestion: (r.category_suggestion as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    created_at: r.created_at as string,
    submitter_email: emailById.get(r.submitted_by as string) ?? null,
    submitter_stats: statsById.get(r.submitted_by as string) ?? null,
  }));
}

export default async function PlaceRequestsPage() {
  const requests = await loadRequests();

  return (
    <div className="min-h-dvh bg-(--map-bg)">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-(--text-primary)">
            Place requests
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-(--text-primary)">Pending</h1>
        <PlaceRequestsQueue requests={requests} />
      </div>
    </div>
  );
}
