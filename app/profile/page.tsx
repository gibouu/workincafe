import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Icon } from '@/components/icons/Icon';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { ProfileTabs } from '@/components/profile/ProfileTabs';

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth');

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    'Traveller';

  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <div className="mx-auto max-w-2xl px-5 py-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-card"
            aria-label="Back"
          >
            <Icon name="ArrowLeft" size={18} />
          </Link>
          <div className="text-[15px] font-semibold text-[var(--text-primary)]">Profile</div>
          <div className="w-9" />
        </div>

        <div className="mt-8 flex flex-col items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sys-gray-5 text-[var(--text-secondary)]">
            <Icon name="UserCircle" size={64} weight="regular" />
          </div>
          <div className="mt-4 text-[22px] font-semibold text-[var(--text-primary)]">{name}</div>
          {user.email && (
            <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{user.email}</div>
          )}
        </div>

        <div className="mt-8">
          <ProfileTabs />
        </div>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
