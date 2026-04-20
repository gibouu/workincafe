import { SignJWT, importPKCS8 } from 'jose';

export const runtime = 'edge';

export async function GET() {
  const keyPem = process.env.APPLE_MAPKIT_PRIVATE_KEY;
  const keyId = process.env.APPLE_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!keyPem || !keyId || !teamId) {
    return Response.json(
      { error: 'MapKit keys not configured. Set APPLE_MAPKIT_PRIVATE_KEY, APPLE_KEY_ID, APPLE_TEAM_ID.' },
      { status: 503 },
    );
  }

  const privateKey = await importPKCS8(keyPem.replace(/\\n/g, '\n'), 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId, typ: 'JWT' })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(privateKey);

  return Response.json(
    { token },
    { headers: { 'cache-control': 'private, max-age=1500' } },
  );
}
