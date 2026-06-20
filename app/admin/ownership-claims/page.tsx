import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isEmailAllowlisted } from '@/lib/auth/admin-allowlist';
import { ClaimRow } from '@/components/admin/ClaimRow';

interface ClaimRecord {
  id: string;
  place_id: string;
  claimant_email: string;
  claimant_name: string | null;
  proof_type: string;
  proof_path: string | null;
  proof_notes: string | null;
  status: string;
  created_at: string;
  places: {
    name: string;
    address: string | null;
    neighborhood: string | null;
    category: string;
  } | null;
}

async function loadClaims(): Promise<ClaimRecord[]> {
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
    .from('place_claims')
    .select(
      'id, place_id, claimant_email, claimant_name, proof_type, proof_path, proof_notes, status, created_at, places(name, address, neighborhood, category)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return ((data ?? []) as unknown) as ClaimRecord[];
}

export default async function OwnershipClaimsPage() {
  const claims = await loadClaims();
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
            Ownership claims
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-(--text-primary)">Pending</h1>
        <p className="mt-1 text-[14px] text-(--text-secondary)">
          {claims.length} pending
        </p>

        {claims.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-(--surface-border) bg-white p-6 text-center text-[13px] text-(--text-secondary) shadow-card">
            No pending claims. New claims show up here as café owners submit them.
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {claims.map((c) => (
              <ClaimRow key={c.id} claim={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
