import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('cron_expire_loyalty migration', () => {
  it('uses a transaction advisory lock to prevent overlapping expiry sweeps', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '014_cron_helpers.sql'),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain("pg_try_advisory_xact_lock(hashtext('cron_expire_loyalty'))");
    expect(sql).toMatch(/if\s+not\s+pg_try_advisory_xact_lock[\s\S]+rows_expired\s*:=\s*0[\s\S]+return\s+next/i);
  });
});
