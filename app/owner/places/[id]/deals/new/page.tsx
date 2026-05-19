import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { isOwnerOf } from '@/lib/auth/request-actor';
import { DealForm, EMPTY_DEAL } from '@/components/owner/DealForm';

export default async function NewDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: placeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth?next=' + encodeURIComponent(`/owner/places/${placeId}/deals/new`));
  const owns = await isOwnerOf(supabase, placeId, user.id);
  if (!owns) notFound();

  return (
    <div className="min-h-dvh bg-(--map-bg)">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/owner/places/${placeId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-(--text-primary)">New deal</div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[24px] font-bold text-(--text-primary)">Create a deal</h1>
        <p className="mt-1 text-[13px] text-(--text-secondary)">
          Drafts are hidden until you flip the Active toggle.
        </p>

        <DealForm
          placeId={placeId}
          initial={EMPTY_DEAL}
          redirectTo={`/owner/places/${placeId}`}
        />
      </div>
    </div>
  );
}
