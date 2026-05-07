import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { isOwnerOf } from '@/lib/auth/request-actor';
import { categoryMeta } from '@/lib/categories';
import type { PlaceCategory } from '@/lib/categories';
import { formatCents } from '@/lib/loyalty/fees';
import { OwnerMenuManager } from '@/components/owner/OwnerMenuManager';

interface DealRow {
  id: string;
  title: string;
  kind: 'single_use' | 'pack';
  pack_size: number;
  price_cents: number;
  currency: string;
  active: boolean;
  ends_at: string | null;
  created_at: string;
}

async function loadOwnerPlaceData(placeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, place: null, deals: [] as DealRow[] };

  const owns = await isOwnerOf(supabase, placeId, user.id);
  if (!owns) return { user, place: null, deals: [] as DealRow[] };

  const { data: place } = await supabase
    .from('places')
    .select('id, name, address, neighborhood, category')
    .eq('id', placeId)
    .maybeSingle();

  const { data: deals } = await supabase
    .from('deals')
    .select('id, title, kind, pack_size, price_cents, currency, active, ends_at, created_at')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  return {
    user,
    place,
    deals: ((deals ?? []) as unknown) as DealRow[],
  };
}

export default async function OwnerPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, place, deals } = await loadOwnerPlaceData(id);

  if (!user) redirect('/auth?next=' + encodeURIComponent(`/owner/places/${id}`));
  if (!place) notFound();

  const meta = categoryMeta((place.category as PlaceCategory) ?? 'other');

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/owner"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Manage place</div>
          <div className="w-9" />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={20} />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-[var(--text-primary)]">{place.name}</h1>
            <p className="text-[12px] text-[var(--text-secondary)]">
              {place.address} · {place.neighborhood}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/owner/places/${place.id}/deals/new`}
            className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card hover:shadow-float transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-tint text-accent">
              <Icon name="Plus" size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">New deal</div>
              <div className="text-[11px] text-[var(--text-secondary)]">Single use or pack</div>
            </div>
          </Link>
          <Link
            href={`/owner/places/${place.id}/scan`}
            className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card hover:shadow-float transition"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-green-tint text-accent-green">
              <Icon name="QrCode" size={18} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-[var(--text-primary)]">Scan code</div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Validate a customer&apos;s ticket
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-8">
          <OwnerMenuManager placeId={place.id} />
        </div>

        <h2 className="mt-8 text-[15px] font-semibold text-[var(--text-primary)]">
          Deals ({deals.length})
        </h2>
        {deals.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)] shadow-card">
            No deals yet. Create one to start selling to remote workers.
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {deals.map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-[var(--text-primary)]">
                        {d.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          d.active
                            ? 'bg-accent-green-tint text-accent-green'
                            : 'bg-sys-gray-6 text-[var(--text-tertiary)]'
                        }`}
                      >
                        {d.active ? 'Live' : 'Draft'}
                      </span>
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {d.kind === 'pack'
                        ? `Pack of ${d.pack_size} · ${formatCents(d.price_cents, d.currency)}`
                        : `Single use · ${formatCents(d.price_cents, d.currency)}`}
                      {d.ends_at && ` · ends ${new Date(d.ends_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <Link
                    href={`/owner/places/${place.id}/deals/${d.id}/edit`}
                    className="shrink-0 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] hover:bg-sys-gray-6"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
