// Generate the Sign in with Apple client-secret JWT that Supabase asks for.
//
// Usage:
//   npx tsx scripts/generate-apple-jwt.ts \
//     --key ~/Downloads/AuthKey_MML58827JB.p8 \
//     --team U6Z87CS4W3 \
//     --kid MML58827JB \
//     --sub cafe.workin.webapp
//
// Pipe to clipboard:
//   npx tsx scripts/generate-apple-jwt.ts ... | pbcopy
//
// Apple caps lifetime at 6 months. Re-run before it expires.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { SignJWT, importPKCS8 } from "jose";

function arg(name: string): string {
  const flag = `--${name}`;
  const i = process.argv.indexOf(flag);
  if (i < 0 || !process.argv[i + 1]) {
    throw new Error(`missing --${name}`);
  }
  return process.argv[i + 1];
}

function expandPath(p: string): string {
  return p.startsWith("~") ? resolve(homedir(), p.slice(2)) : resolve(p);
}

async function main() {
  const keyPath = expandPath(arg("key"));
  const team = arg("team");
  const kid = arg("kid");
  const sub = arg("sub");

  const pkcs8 = readFileSync(keyPath, "utf8");
  const privateKey = await importPKCS8(pkcs8, "ES256");

  const now = Math.floor(Date.now() / 1000);
  const sixMonths = 60 * 60 * 24 * 180;

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid })
    .setIssuer(team)
    .setIssuedAt(now)
    .setExpirationTime(now + sixMonths)
    .setAudience("https://appleid.apple.com")
    .setSubject(sub)
    .sign(privateKey);

  process.stdout.write(jwt + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
