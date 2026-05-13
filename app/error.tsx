'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--map-bg)] px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-red-tint">
        <Icon name="Warning" weight="fill" size={36} className="text-accent-red" />
      </div>
      <h1 className="mt-5 text-[28px] font-bold text-[var(--text-primary)]">
        Something went sideways
      </h1>
      <p className="mt-2 max-w-sm text-[14px] text-[var(--text-secondary)]">
        {error.message || 'An unexpected error occurred.'}
      </p>
      {error.digest && (
        <code className="mt-2 rounded bg-sys-gray-6 px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
          {error.digest}
        </code>
      )}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-2xl border border-[var(--surface-border)] bg-white px-6 py-3 text-[15px] font-semibold text-[var(--text-primary)] hover:bg-sys-gray-6 transition"
        >
          Back to map
        </Link>
      </div>
    </div>
  );
}
