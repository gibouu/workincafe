import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';
import { WaitlistForm } from '@/components/waitlist/WaitlistForm';

export const metadata = { title: 'Find a study partner · Work in Cafe' };

export default function PartnersWaitlistPage() {
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
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Partners</div>
          <div className="w-9" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pb-10">
        <div className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-card">
          <Icon name="UsersThree" weight="fill" size={36} className="text-accent" />
        </div>
        <WaitlistForm
          list="partners"
          title="Find a study partner"
          subtitle="Match with someone working from the same café. Quiet company, shared focus sessions."
        />
      </main>
    </div>
  );
}
