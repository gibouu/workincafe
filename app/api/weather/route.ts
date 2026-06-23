import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'edge';

interface OpenMeteoResponse {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({}, { status: 200 });
  }

  const upstream = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`;
  try {
    const resp = await fetch(upstream, { next: { revalidate: 1800 } });
    if (!resp.ok) return NextResponse.json({}, { status: 200 });
    const data = (await resp.json()) as OpenMeteoResponse;
    const temp = data.current?.temperature_2m ?? null;
    const code = data.current?.weather_code ?? null;
    return NextResponse.json({ temp_c: temp, weather_code: code });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
