import { ProfileBody } from '@/components/profile/ProfileBody';

export const metadata = { title: 'Profile · Work in Cafe' };

export default function ProfileRoute() {
  return (
    <div className="min-h-dvh bg-(--map-bg)">
      <ProfileBody />
    </div>
  );
}
