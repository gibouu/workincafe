import { NextResponse, type NextRequest } from 'next/server';

// Approximate geo from Vercel-injected request headers. In dev the
// headers are absent and we return a 204 so the client can skip its pan.
export async function GET(request: NextRequest) {
  const lat = request.headers.get('x-vercel-ip-latitude');
  const lng = request.headers.get('x-vercel-ip-longitude');
  const city = request.headers.get('x-vercel-ip-city');
  const country = request.headers.get('x-vercel-ip-country');

  const latNum = lat ? Number(lat) : NaN;
  const lngNum = lng ? Number(lng) : NaN;

  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({
    lat: latNum,
    lng: lngNum,
    city: city ? decodeURIComponent(city) : null,
    country: country ?? null,
  });
}
