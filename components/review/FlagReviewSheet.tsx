'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { useToasts } from '@/lib/store/toasts';

type FlagReason = 'spam' | 'offensive' | 'untrue' | 'irrelevant' | 'other';

const REASONS: { value: FlagReason; label: string; icon: PhosphorIconName }[] = [
  { value: 'spam', label: 'Spam or advertising', icon: 'Megaphone' },
  { value: 'offensive', label: 'Offensive', icon: 'Warning' },
  { value: 'untrue', label: 'Untrue or misleading', icon: 'SmileyXEyes' },
  { value: 'irrelevant', label: 'Not about this place', icon: 'MapPin' },
  { value: 'other', label: 'Something else', icon: 'DotsThree' },
];

export function FlagReviewSheet({
  open,
  onOpenChange,
  reviewId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reviewId: string | null;
}) {
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [notes, setNotes] = useState('');
  const showToast = useToasts((s) => s.show);

  const reset = () => {
    setReason(null);
    setNotes('');
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const onSubmit = () => {
    if (!reason || !reviewId) return;
    // Demo only — real POST to /api/reviews/[id]/flag lands in Phase 5.
    showToast('Thanks — we\u2019ll review this flag', { tone: 'info' });
    handleClose(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleClose} snapPoints={[0.6, 0.9]}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-md rounded-t-3xl bg-white shadow-float outline-none flex flex-col max-h-[95vh]">
          <Drawer.Title className="sr-only">Flag review</Drawer.Title>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-sys-gray-4" />

          <div className="flex items-center justify-between px-5 pt-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                Report
              </div>
              <div className="text-[17px] font-semibold text-[var(--text-primary)]">
                What&apos;s wrong with this review?
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose(false)}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-sys-gray-6 text-[var(--text-secondary)]"
            >
              <Icon name="X" size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    reason === r.value
                      ? 'border-accent bg-accent-tint'
                      : 'border-[var(--surface-border)] bg-white hover:bg-sys-gray-6'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      name={r.icon}
                      size={18}
                      className={reason === r.value ? 'text-accent' : 'text-[var(--text-secondary)]'}
                    />
                    <span
                      className={`text-[14px] ${
                        reason === r.value
                          ? 'font-semibold text-accent'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {r.label}
                    </span>
                  </div>
                  {reason === r.value && <Icon name="Check" size={14} className="text-accent" />}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                Notes (optional)
              </div>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 280))}
                placeholder="Anything a moderator should know"
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-[var(--surface-border)] bg-[var(--map-bg)] px-3 py-2 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </label>
          </div>

          <div className="border-t border-[var(--surface-border)] p-4">
            <button
              type="button"
              disabled={!reason}
              onClick={onSubmit}
              className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:bg-sys-gray-4 disabled:cursor-not-allowed transition"
            >
              Submit flag
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
