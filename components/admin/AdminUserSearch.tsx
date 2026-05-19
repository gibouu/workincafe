'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

interface SearchResult {
  id: string;
  email: string | null;
  name: string | null;
  is_admin: boolean;
}

export function AdminUserSearch({
  selfId,
  adminCount,
}: {
  selfId: string | null;
  adminCount: number;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      setError('Type at least 2 characters');
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/users/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q: q.trim() }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `request failed (${resp.status})`);
      setResults(body.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  const toggleAdmin = async (target: SearchResult) => {
    setPendingId(target.id);
    setError(null);
    try {
      const resp = await fetch(`/api/admin/users/${target.id}/admin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ promote: !target.is_admin }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body.error ?? `request failed (${resp.status})`);
      setResults((prev) =>
        prev
          ? prev.map((r) => (r.id === target.id ? { ...r, is_admin: !target.is_admin } : r))
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email…"
          className="flex-1 rounded-xl border border-(--surface-border) bg-white px-4 py-2.5 text-[14px] focus:outline-hidden focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-xl bg-accent-red-tint p-2 text-center text-[12px] text-accent-red">
          {error}
        </div>
      )}

      {results !== null && results.length === 0 && (
        <div className="mt-3 rounded-2xl border border-(--surface-border) bg-white p-4 text-center text-[13px] text-(--text-secondary) shadow-card">
          No users found. They need to sign in via Google or Apple at least
          once before they show up here.
        </div>
      )}

      {results && results.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {results.map((r) => {
            const isSelf = r.id === selfId;
            const wouldOrphan = !!isSelf && r.is_admin && adminCount <= 1;
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-(--surface-border) bg-white p-4 shadow-card"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sys-gray-6 text-(--text-secondary)">
                  <Icon name="UserCircle" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-(--text-primary)">
                    {r.name ?? r.email ?? '(no name)'}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-sys-gray-6 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-(--text-tertiary)">
                        You
                      </span>
                    )}
                    {r.is_admin && (
                      <span className="ml-2 rounded-full bg-accent-green-tint px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent-green">
                        Admin
                      </span>
                    )}
                  </div>
                  {r.email && (
                    <div className="truncate text-[12px] text-(--text-secondary)">
                      {r.email}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => toggleAdmin(r)}
                  disabled={pendingId === r.id || wouldOrphan}
                  title={wouldOrphan ? 'Promote someone else first' : undefined}
                  className={`shrink-0 rounded-xl px-3 py-2 text-[12px] font-semibold transition ${
                    r.is_admin
                      ? 'bg-accent-red-tint text-accent-red hover:opacity-90'
                      : 'bg-accent text-white hover:opacity-90'
                  } disabled:opacity-50`}
                >
                  {pendingId === r.id ? '…' : r.is_admin ? 'Demote' : 'Promote'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
