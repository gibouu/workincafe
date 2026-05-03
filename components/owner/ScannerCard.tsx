'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

interface ScanResult {
  ok: boolean;
  uses_remaining?: number;
  uses_total?: number;
  deal_title?: string;
  error?: string;
}

export function ScannerCard() {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const resp = await fetch('/api/deal-uses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ qr_code: code.trim() }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setResult({ ok: false, error: body.error ?? `request failed (${resp.status})` });
      } else {
        setResult({
          ok: true,
          uses_remaining: body.uses_remaining,
          uses_total: body.uses_total,
          deal_title: body.deal_title,
        });
        setCode('');
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-white p-5 shadow-card">
      <form onSubmit={onSubmit}>
        <label className="block">
          <div className="text-[12px] font-medium text-[var(--text-secondary)]">
            Customer code
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-EFGH-JKLM"
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="characters"
            className="mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-white px-4 py-4 text-center text-[20px] font-mono tracking-widest text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </label>
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="mt-4 w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
        >
          {submitting ? 'Validating…' : 'Validate'}
        </button>
      </form>

      {result?.ok && (
        <div className="mt-4 rounded-xl bg-accent-green-tint p-4 text-accent-green">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="CheckCircle" size={20} weight="fill" />
            <span>Validated</span>
          </div>
          <div className="mt-1 text-[13px]">
            {result.deal_title} — {result.uses_remaining} of {result.uses_total} remaining
          </div>
          <div className="mt-1 text-[12px] opacity-80">+1 loyalty point awarded</div>
        </div>
      )}
      {result && !result.ok && (
        <div className="mt-4 rounded-xl bg-accent-red-tint p-4 text-accent-red">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <Icon name="XCircle" size={20} weight="fill" />
            <span>Couldn&apos;t validate</span>
          </div>
          <div className="mt-1 text-[13px]">{result.error}</div>
        </div>
      )}

      <p className="mt-4 text-[11px] text-[var(--text-tertiary)]">
        Type or paste the customer&apos;s code. Camera scanning lands in a future update — for now,
        iOS Camera + paste works.
      </p>
    </div>
  );
}
