'use client';

import { Icon, type PhosphorIconName } from '@/components/icons/Icon';
import { useToasts, type ToastTone } from '@/lib/store/toasts';

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'bg-accent-green text-white',
  info: 'bg-[var(--text-primary)] text-white',
  error: 'bg-accent-red text-white',
};

const TONE_ICON: Record<ToastTone, PhosphorIconName> = {
  success: 'CheckCircle',
  info: 'Info',
  error: 'Warning',
};

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium shadow-float backdrop-blur-ios ${TONE_CLASS[t.tone]}`}
          role="status"
        >
          <Icon name={TONE_ICON[t.tone]} size={14} weight="fill" />
          <span>{t.message}</span>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="ml-1 rounded-full p-0.5 opacity-80 hover:opacity-100"
            aria-label="Dismiss"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
