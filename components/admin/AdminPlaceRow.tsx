'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { CATEGORIES, categoryMeta, type PlaceCategory } from '@/lib/categories';

export interface AdminPlaceRecord {
  id: string;
  name: string;
  brand: string | null;
  category: PlaceCategory;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  created_at: string;
  parent_place_id: string | null;
  user_validated_at: string | null;
}

interface Draft {
  name: string;
  brand: string;
  category: PlaceCategory;
  address: string;
  neighborhood: string;
  city: string;
  country: string;
}

function asDraft(p: AdminPlaceRecord): Draft {
  return {
    name: p.name,
    brand: p.brand ?? '',
    category: p.category,
    address: p.address ?? '',
    neighborhood: p.neighborhood ?? '',
    city: p.city ?? '',
    country: p.country ?? '',
  };
}

export function AdminPlaceRow({
  place: initial,
  onDeleted,
}: {
  place: AdminPlaceRecord;
  onDeleted: (id: string) => void;
}) {
  const [place, setPlace] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(asDraft(initial));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = categoryMeta(place.category);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/places/${place.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          brand: draft.brand || null,
          category: draft.category,
          address: draft.address || null,
          neighborhood: draft.neighborhood || null,
          city: draft.city || null,
          country: draft.country || null,
        }),
      });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `request failed (${resp.status})`);
      }
      const body = (await resp.json()) as { place: AdminPlaceRecord };
      setPlace((p) => ({ ...p, ...body.place }));
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/places/${place.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `delete failed (${resp.status})`);
      }
      onDeleted(place.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'delete failed');
      setDeleting(false);
    }
  };

  if (!editing) {
    return (
      <li className="rounded-2xl border border-[var(--surface-border)] bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-[var(--text-primary)]">
              {place.name}
              {place.brand ? (
                <span className="ml-2 text-[12px] font-normal text-[var(--text-tertiary)]">
                  · {place.brand}
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {meta.label}
              {place.address ? ` · ${place.address}` : ''}
              {place.neighborhood ? ` · ${place.neighborhood}` : ''}
            </div>
            <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
              {[place.city, place.country].filter(Boolean).join(', ') || 'no city/country'} ·{' '}
              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
              {place.user_validated_at ? ' · user-validated' : ''}
              {place.parent_place_id ? ' · child of another place' : ''}
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDraft(asDraft(place));
                setEditing(true);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-primary)] hover:bg-sys-gray-5 transition"
              aria-label="Edit"
              title="Edit"
            >
              <Icon name="PencilSimple" size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(true);
                setConfirmName('');
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-red-tint text-accent-red hover:opacity-90 transition"
              aria-label="Delete"
              title="Delete"
            >
              <Icon name="Trash" size={14} />
            </button>
          </div>
        </div>
        {showConfirm && (
          <div className="mt-3 rounded-xl border border-accent-red bg-accent-red-tint p-3">
            <div className="text-[12px] text-[var(--text-primary)]">
              Type the place name to confirm hard delete (this also removes all reviews + claims):
            </div>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={place.name}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-white px-2 py-1.5 text-[13px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent-red"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmName('');
                }}
                disabled={deleting}
                className="flex-1 rounded-lg border border-[var(--surface-border)] bg-white py-1.5 text-[12px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={deleting || confirmName !== place.name}
                className="flex-1 rounded-lg bg-accent-red py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
              >
                {deleting ? 'Deleting…' : 'Hard delete'}
              </button>
            </div>
          </div>
        )}
        {error && (
          <div className="mt-2 rounded-lg bg-accent-red-tint px-2 py-1 text-[12px] text-accent-red">
            {error}
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="rounded-2xl border border-accent bg-white p-4 shadow-card">
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Name</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Brand</div>
          <input
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Category</div>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as PlaceCategory })}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {(Object.keys(CATEGORIES) as PlaceCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORIES[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Address</div>
          <input
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Neighborhood</div>
          <input
            value={draft.neighborhood}
            onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">City</div>
            <input
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-[var(--text-secondary)]">Country</div>
            <input
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
              maxLength={2}
              placeholder="FR"
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--map-bg)] px-2 py-1.5 text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="flex-1 rounded-xl border border-[var(--surface-border)] bg-white py-2 text-[13px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 disabled:opacity-60 transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || !draft.name.trim()}
          className="flex-1 rounded-xl bg-accent py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60 transition"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {error && (
        <div className="mt-2 rounded-lg bg-accent-red-tint px-2 py-1 text-[12px] text-accent-red">
          {error}
        </div>
      )}
    </li>
  );
}
