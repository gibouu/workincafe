import { AddPlaceWizard } from './AddPlaceWizard';

function parseBbox(raw: string | undefined): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(',').map((s) => Number.parseFloat(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return null;
  return [w, s, e, n];
}

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ lat?: string; lng?: string; bbox?: string }>;
}) {
  const sp = await searchParams;
  const lat = parseFloat(sp.lat ?? '');
  const lng = parseFloat(sp.lng ?? '');
  const center =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const bbox = parseBbox(sp.bbox);
  return <AddPlaceWizard center={center} bbox={bbox} />;
}
