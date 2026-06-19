import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function allMigrationSql(): string {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

describe('deal_purchases RLS migrations', () => {
  it('keeps direct authenticated ticket minting disabled', () => {
    const sql = allMigrationSql().toLowerCase();

    expect(sql).not.toMatch(
      /create\s+policy\s+"purchases_insert_self"\s+on\s+public\.deal_purchases/i,
    );
    expect(sql).toMatch(
      /revoke\s+insert\s+on\s+(?:table\s+)?public\.deal_purchases\s+from\s+anon\s*,\s*authenticated/i,
    );
  });
});
