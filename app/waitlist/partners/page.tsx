import { FriendsBody } from '@/components/friends/FriendsBody';

export const metadata = { title: 'Cowork · Work in Cafe' };

export default function FriendsRoute() {
  return (
    <div className="min-h-dvh bg-[var(--map-bg)]">
      <FriendsBody />
    </div>
  );
}
