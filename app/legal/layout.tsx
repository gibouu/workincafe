import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <header className="border-b border-[var(--surface-border)] bg-white/80 backdrop-blur-ios">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sys-gray-6"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Legal</div>
          <div className="w-9" />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 text-[15px] leading-relaxed text-[var(--text-primary)]">
        {children}
      </main>
    </div>
  );
}
