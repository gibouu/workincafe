import { AddPlaceWizard } from './AddPlaceWizard';

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string }>;
}) {
  const sp = await searchParams;
  const lat = parseFloat(sp.lat ?? '');
  const lng = parseFloat(sp.lng ?? '');
  const center =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  return <AddPlaceWizard center={center} />;
}
