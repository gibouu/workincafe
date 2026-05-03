import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Icon } from '@/components/icons/Icon';
import { createClient } from '@/lib/supabase/server';
import { categoryMeta } from '@/lib/categories';
import type { PlaceCategory } from '@/lib/categories';
import { PayoutsCard } from '@/components/owner/PayoutsCard';

export const metadata = { title: 'Your places · Work in Cafe' };

interface OwnedPlace {
  place_id: string;
  places: {
    name: string;
    address: string | null;
    neighborhood: string | null;
    category: PlaceCategory;
  } | null;
}

async function loadOwnedPlaces(): Promise<OwnedPlace[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return [];
  const { data, error } = await supabase
    .from('place_owners')
    .select('place_id, places(name, address, neighborhood, category)')
    .eq('user_id', auth.user.id)
    .is('revoked_at', null);
  if (error) return [];
  return ((data ?? []) as unknown) as OwnedPlace[];
}

export default async function OwnerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth?next=' + encodeURIComponent('/owner'));
  }

  const owned = await loadOwnedPlaces();

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-3xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">
            Owner
          </div>
          <div className="w-9" />
        </div>

        <h1 className="mt-6 text-[28px] font-bold text-[var(--text-primary)]">Your places</h1>
        <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
          {owned.length === 0
            ? 'You don’t own any places yet.'
            : `${owned.length} ${owned.length === 1 ? 'place' : 'places'}`}
        </p>

        {owned.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-white p-6 text-center text-[13px] text-[var(--text-secondary)] shadow-card">
            <p>Find your place on the map and tap “Claim this place.”</p>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90"
            >
              <Icon name="MapPin" size={14} />
              <span>Open the map</span>
            </Link>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {owned.map((row) => {
              if (!row.places) return null;
              const meta = categoryMeta(row.places.category);
              return (
                <li key={row.place_id}>
                  <Link
                    href={`/owner/places/${row.place_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card hover:shadow-float transition"
                  >
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-bubble"
                      style={{ background: meta.color }}
                    >
                      <Icon name={meta.icon} size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-semibold text-[var(--text-primary)]">
                        {row.places.name}
                      </div>
                      <div className="truncate text-[12px] text-[var(--text-secondary)]">
                        {row.places.address} · {row.places.neighborhood}
                      </div>
                    </div>
                    <Icon name="ArrowRight" size={16} className="text-[var(--text-secondary)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-8">
          <PayoutsCard />
        </div>
      </div>
    </div>
  );
}
