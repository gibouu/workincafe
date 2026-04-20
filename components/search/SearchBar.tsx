'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { categoryMeta } from '@/lib/categories';
import { PARIS_DEMO_PLACES, type DemoPlace } from '@/lib/demo/paris-places';

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function score(query: string, place: DemoPlace): number {
  const q = normalize(query.trim());
  if (!q) return 0;
  const name = normalize(place.name);
  const address = normalize(place.address);
  let s = 0;
  if (name.startsWith(q)) s += 100;
  else if (name.includes(q)) s += 60;
  if (address.includes(q)) s += 20;
  // fuzzy: every char in order
  let i = 0;
  for (const ch of name) {
    if (ch === q[i]) i++;
    if (i === q.length) break;
  }
  if (i === q.length) s += 10;
  return s;
}

export function SearchBar({
  onSelect,
}: {
  onSelect: (place: DemoPlace) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    }
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpanded(false);
        setQuery('');
      }
    };
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClick);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClick);
    };
  }, [expanded]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return [...PARIS_DEMO_PLACES]
      .map((p) => ({ p, s: score(query, p) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 6)
      .map((x) => x.p);
  }, [query]);

  const pick = (place: DemoPlace) => {
    onSelect(place);
    setExpanded(false);
    setQuery('');
  };

  if (!expanded) {
    return (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setExpanded(true)}
        className="pointer-events-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur-ios shadow-float text-[var(--text-primary)] hover:bg-white transition"
      >
        <Icon name="MagnifyingGlass" size={22} />
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-auto flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] backdrop-blur-ios shadow-float"
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <Icon name="MagnifyingGlass" size={20} className="text-[var(--text-secondary)]" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a cafe…"
          className="flex-1 bg-transparent text-[15px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setQuery('');
          }}
          aria-label="Close search"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)] hover:bg-sys-gray-5 transition"
        >
          <Icon name="X" size={14} />
        </button>
      </div>

      {query.trim() && (
        <ul className="max-h-[50vh] overflow-y-auto border-t border-[var(--surface-border)] bg-white">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13px] text-[var(--text-secondary)]">
              No matches. Try another name.
            </li>
          ) : (
            results.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-sys-gray-6 transition"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-bubble"
                      style={{ background: meta.color }}
                    >
                      <Icon name={meta.icon} size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold text-[var(--text-primary)]">
                        {p.name}
                      </div>
                      <div className="truncate text-[12px] text-[var(--text-secondary)]">
                        {p.address} · {p.neighborhood}
                      </div>
                    </div>
                    <Icon name="ArrowRight" size={14} className="text-[var(--text-secondary)]" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
