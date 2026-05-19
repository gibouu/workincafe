import Link from 'next/link';
import { Icon } from '@/components/icons/Icon';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-(--map-bg) px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sys-gray-6">
        <Icon name="MagnifyingGlass" size={36} className="text-(--text-secondary)" />
      </div>
      <h1 className="mt-5 text-[28px] font-bold text-(--text-primary)">Not found</h1>
      <p className="mt-2 max-w-sm text-[14px] text-(--text-secondary)">
        We couldn&apos;t find that page. The map is still waiting though.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-2xl bg-accent px-6 py-3 text-[15px] font-semibold text-white hover:opacity-90 transition"
      >
        Back to map
      </Link>
    </div>
  );
}
