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

interface MergeCandidate {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string | null;
  lat: number;
  lng: number;
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

  // Merge-into state.
  const [showMerge, setShowMerge] = useState(false);
  const [mergeQuery, setMergeQuery] = useState('');
  const [mergeCandidates, setMergeCandidates] = useState<MergeCandidate[]>([]);
  const [mergeSearching, setMergeSearching] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<MergeCandidate | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeSummary, setMergeSummary] = useState<Record<string, number> | null>(null);

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

  // Search the existing /api/admin/places endpoint scoped to the merge
  // dialog. Excludes the current row so we can't merge into ourselves.
  const searchMergeCandidates = async (q: string) => {
    setMergeSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, pageSize: '8' });
      const resp = await fetch(`/api/admin/places?${params.toString()}`);
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `search failed (${resp.status})`);
      }
      const body = (await resp.json()) as { places: AdminPlaceRecord[] };
      setMergeCandidates(
        body.places
          .filter((p) => p.id !== place.id)
          .map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            city: p.city,
            lat: p.lat,
            lng: p.lng,
          })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search failed');
    } finally {
      setMergeSearching(false);
    }
  };

  const runMerge = async () => {
    if (!mergeTarget) return;
    setMerging(true);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/places/${place.id}/merge-into`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target_id: mergeTarget.id }),
      });
      const body = (await resp.json().catch(() => ({}))) as {
        error?: string;
        summary?: Record<string, number>;
      };
      if (!resp.ok) {
        throw new Error(body.error ?? `merge failed (${resp.status})`);
      }
      setMergeSummary(body.summary ?? {});
      // Source row is gone — pull it out of the parent list so the page
      // re-renders without it.
      setTimeout(() => onDeleted(place.id), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'merge failed');
      setMerging(false);
    }
  };

  if (!editing) {
    return (
      <li className="rounded-2xl border border-(--surface-border) bg-white p-4 shadow-card">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
            style={{ background: meta.color }}
          >
            <Icon name={meta.icon} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-(--text-primary)">
              {place.name}
              {place.brand ? (
                <span className="ml-2 text-[12px] font-normal text-(--text-tertiary)">
                  · {place.brand}
                </span>
              ) : null}
            </div>
            <div className="text-[12px] text-(--text-secondary)">
              {meta.label}
              {place.address ? ` · ${place.address}` : ''}
              {place.neighborhood ? ` · ${place.neighborhood}` : ''}
            </div>
            <div className="mt-1 text-[11px] text-(--text-tertiary)">
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
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-primary) hover:bg-sys-gray-5 transition"
              aria-label="Edit"
              title="Edit"
            >
              <Icon name="PencilSimple" size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMerge(true);
                setMergeQuery(place.name);
                void searchMergeCandidates(place.name);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-primary) hover:bg-sys-gray-5 transition"
              aria-label="Merge into another place"
              title="Merge into another place"
            >
              <Icon name="ArrowsMerge" size={14} />
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
        {showMerge && (
          <div className="mt-3 rounded-xl border border-accent bg-accent-tint p-3">
            {mergeSummary ? (
              <div className="text-[12px] text-(--text-primary)">
                <div className="font-semibold mb-1">
                  Merged into {mergeTarget?.name}. Rows moved:
                </div>
                <ul className="space-y-0.5">
                  {Object.entries(mergeSummary)
                    .filter(([, n]) => n > 0)
                    .map(([k, n]) => (
                      <li key={k} className="font-mono text-[11px]">
                        {k}: {n}
                      </li>
                    ))}
                </ul>
                {Object.values(mergeSummary).every((n) => n === 0 || n === 1) && (
                  <div className="mt-1 text-[11px] text-(--text-secondary)">
                    Row removed; closing in a moment…
                  </div>
                )}
              </div>
            ) : mergeTarget ? (
              <>
                <div className="text-[12px] text-(--text-primary)">
                  Merge <strong>{place.name}</strong> into{' '}
                  <strong>{mergeTarget.name}</strong>?
                </div>
                <div className="mt-1 text-[11px] text-(--text-secondary)">
                  Reviews, claims, owners, deals, source-refs, children — all
                  transfer to <strong>{mergeTarget.name}</strong>. This row is
                  then deleted. Cannot be undone.
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMergeTarget(null)}
                    disabled={merging}
                    className="flex-1 rounded-lg border border-(--surface-border) bg-white py-1.5 text-[12px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
                  >
                    Pick different target
                  </button>
                  <button
                    type="button"
                    onClick={runMerge}
                    disabled={merging}
                    className="flex-1 rounded-lg bg-accent py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-40 transition"
                  >
                    {merging ? 'Merging…' : 'Confirm merge'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[12px] font-semibold text-(--text-primary)">
                  Pick the canonical place to merge <em>{place.name}</em> into:
                </div>
                <input
                  value={mergeQuery}
                  onChange={(e) => {
                    setMergeQuery(e.target.value);
                    if (e.target.value.trim().length >= 2) {
                      void searchMergeCandidates(e.target.value.trim());
                    } else {
                      setMergeCandidates([]);
                    }
                  }}
                  placeholder="Search by name…"
                  className="mt-2 w-full rounded-lg border border-(--surface-border) bg-white px-2 py-1.5 text-[13px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
                />
                <div className="mt-2 max-h-48 overflow-y-auto">
                  {mergeSearching && (
                    <div className="text-[11px] text-(--text-secondary) py-1">
                      Searching…
                    </div>
                  )}
                  {!mergeSearching && mergeCandidates.length === 0 && (
                    <div className="text-[11px] text-(--text-secondary) py-1">
                      No matches.
                    </div>
                  )}
                  <ul className="space-y-1">
                    {mergeCandidates.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setMergeTarget(c)}
                          className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[12px] hover:bg-sys-gray-6 transition"
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-[10px] text-(--text-secondary)">
                            {c.category} · {c.city ?? 'no city'} ·{' '}
                            {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowMerge(false);
                    setMergeCandidates([]);
                    setMergeQuery('');
                  }}
                  className="mt-2 w-full rounded-lg border border-(--surface-border) bg-white py-1.5 text-[12px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 transition"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        {showConfirm && (
          <div className="mt-3 rounded-xl border border-accent-red bg-accent-red-tint p-3">
            <div className="text-[12px] text-(--text-primary)">
              Type the place name to confirm hard delete (this also removes all reviews + claims):
            </div>
            <input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={place.name}
              className="mt-2 w-full rounded-lg border border-(--surface-border) bg-white px-2 py-1.5 text-[13px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent-red"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmName('');
                }}
                disabled={deleting}
                className="flex-1 rounded-lg border border-(--surface-border) bg-white py-1.5 text-[12px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
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
          <div className="text-[11px] font-semibold text-(--text-secondary)">Name</div>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-(--text-secondary)">Brand</div>
          <input
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-(--text-secondary)">Category</div>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as PlaceCategory })}
            className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          >
            {(Object.keys(CATEGORIES) as PlaceCategory[]).map((k) => (
              <option key={k} value={k}>
                {CATEGORIES[k].label}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2">
          <div className="text-[11px] font-semibold text-(--text-secondary)">Address</div>
          <input
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>
        <label>
          <div className="text-[11px] font-semibold text-(--text-secondary)">Neighborhood</div>
          <input
            value={draft.neighborhood}
            onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}
            className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <div className="text-[11px] font-semibold text-(--text-secondary)">City</div>
            <input
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value })}
              className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
            />
          </label>
          <label>
            <div className="text-[11px] font-semibold text-(--text-secondary)">Country</div>
            <input
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
              maxLength={2}
              placeholder="FR"
              className="mt-1 w-full rounded-lg border border-(--surface-border) bg-(--map-bg) px-2 py-1.5 text-[14px] text-(--text-primary) focus:outline-hidden focus:ring-2 focus:ring-accent"
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={saving}
          className="flex-1 rounded-xl border border-(--surface-border) bg-white py-2 text-[13px] font-semibold text-(--text-primary) hover:bg-sys-gray-6 disabled:opacity-60 transition"
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
