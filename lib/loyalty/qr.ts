import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // base32-ish, no I/O/0/1
const CODE_LENGTH = 12; // 32^12 ≈ 1.15e18 — collision-resistant for our scale

/**
 * Random short opaque code that doubles as the QR payload.
 * Server-issued. Do NOT include any user-derived data — validation
 * happens by lookup, not by decoding.
 */
export function generateRedemptionCode(): string {
  const buf = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

/** Visual grouping for the user-facing screen: "ABCD-EFGH-JKLM". */
export function formatCodeForHumans(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}
