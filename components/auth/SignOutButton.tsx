'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/icons/Icon';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/auth');
    router.refresh();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-white py-3.5 text-[15px] font-semibold text-accent-red hover:bg-accent-red-tint disabled:opacity-60 transition"
    >
      <Icon
        name={loading ? 'CircleNotch' : 'SignOut'}
        size={18}
        className={loading ? 'animate-spin' : ''}
      />
      <span>Sign out</span>
    </button>
  );
}
