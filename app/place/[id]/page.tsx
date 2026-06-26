import { redirect } from 'next/navigation';

// The full place profile is now inlined into the place card on the map.
// Keep this route as a redirect so old links / bookmarks don't 404.
export default async function PlaceRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?place=${encodeURIComponent(id)}`);
}
