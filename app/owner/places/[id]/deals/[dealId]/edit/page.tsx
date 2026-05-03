import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { isOwnerOf } from '@/lib/auth/request-actor';
import { DealForm } from '@/components/owner/DealForm';

interface DealRow {
  id: string;
  title: string;
  description: string | null;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
  ends_at: string | null;
  purchase_limit_per_user: number | null;
  active: boolean;
}

export default async function EditDealPage({
  params,
}: {
  params: Promise<{ id: string; dealId: string }>;
}) {
  const { id: placeId, dealId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth?next=' + encodeURIComponent(`/owner/places/${placeId}/deals/${dealId}/edit`));
  }
  const owns = await isOwnerOf(supabase, placeId, user.id);
  if (!owns) notFound();

  const { data: deal } = await supabase
    .from('deals')
    .select(
      'id, title, description, kind, pack_size, price_cents, currency, ends_at, purchase_limit_per_user, active',
    )
    .eq('id', dealId)
    .eq('place_id', placeId)
    .maybeSingle();
  if (!deal) notFound();
  const d = (deal as unknown) as DealRow;

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/owner/places/${placeId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Edit deal</div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[24px] font-bold text-[var(--text-primary)]">Edit deal</h1>

        <DealForm
          placeId={placeId}
          initial={{
            id: d.id,
            title: d.title,
            description: d.description ?? '',
            kind: d.kind,
            pack_size: d.pack_size,
            price_cents: d.price_cents,
            currency: d.currency,
            ends_at: d.ends_at,
            purchase_limit_per_user: d.purchase_limit_per_user,
            active: d.active,
          }}
          redirectTo={`/owner/places/${placeId}`}
        />
      </div>
    </div>
  );
}
