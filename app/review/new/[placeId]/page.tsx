import { notFound } from 'next/navigation';
import { findPlace } from '@/lib/store/city';
import { ReviewForm } from '@/components/review/ReviewForm';

export default async function NewReviewPage({
  params,
}: {
  params: Promise<{ placeId: string }>;
}) {
  const { placeId } = await params;
  const place = findPlace(placeId);
  if (!place) notFound();

  return <ReviewForm place={place} />;
}
