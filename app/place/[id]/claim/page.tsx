import { notFound } from 'next/navigation';
import { findPlace } from '@/lib/demo/cities';
import { ClaimWizard } from '@/components/claim/ClaimWizard';

export const metadata = { title: 'Claim this place · Work in Cafe' };

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = findPlace(id);
  if (!place) notFound();
  return <ClaimWizard place={place} />;
}
