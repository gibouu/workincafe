import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { isOwnerOf } from '@/lib/auth/request-actor';
import { ScannerCard } from '@/components/owner/ScannerCard';

export default async function ScanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: placeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=' + encodeURIComponent(`/owner/places/${placeId}/scan`));
  const owns = await isOwnerOf(supabase, placeId, user.id);
  if (!owns) notFound();

  const { data: place } = await supabase
    .from('places')
    .select('name')
    .eq('id', placeId)
    .maybeSingle();

  return (
    <div className="min-h-dvh bg-(--map-bg)">
      <div className="mx-auto max-w-md px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/owner/places/${placeId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-(--text-primary)">Scan code</div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[24px] font-bold text-(--text-primary)">
          {place?.name ?? 'Scan'}
        </h1>
        <p className="mt-1 text-[13px] text-(--text-secondary)">
          Type or paste the customer&apos;s code. Each valid scan consumes one use and awards the
          customer one loyalty point.
        </p>

        <div className="mt-5">
          <ScannerCard />
        </div>
      </div>
    </div>
  );
}
