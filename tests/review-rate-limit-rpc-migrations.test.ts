import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function allMigrationSql(): string {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n')
    .toLowerCase();
}

describe('submit_review_rate_limited migration', () => {
  it('checks the daily review limit and inserts inside one locked RPC', () => {
    const sql = allMigrationSql();

    expect(sql).toContain('create or replace function public.submit_review_rate_limited');
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('submit_review_rate_limited:'");
    expect(sql).toMatch(/select\s+count\(\*\)[\s\S]+from\s+public\.reviews/i);
    expect(sql).toMatch(/insert\s+into\s+public\.reviews[\s\S]+returning\s+reviews\.id/i);
    expect(sql).toContain('revoke all on function public.submit_review_rate_limited');
    expect(sql).toContain('grant execute on function public.submit_review_rate_limited');
  });
});
