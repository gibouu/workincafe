import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function HEAD() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'cache-control': 'no-store', 'x-workin-cafe': 'ping' },
  });
}

export async function GET() {
  return new NextResponse(null, {
    status: 204,
    headers: { 'cache-control': 'no-store', 'x-workin-cafe': 'ping' },
  });
}
