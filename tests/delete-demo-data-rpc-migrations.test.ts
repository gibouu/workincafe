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

describe('delete_demo_data RPC permissions', () => {
  it('keeps the destructive demo cleanup RPC service-role only', () => {
    const sql = allMigrationSql();
    const revokeStatements = [
      ...sql.matchAll(
        /revoke\s+(?:all|execute)\s+on\s+function\s+public\.delete_demo_data\(\)\s+from\s+([^;]+);/gi,
      ),
    ].map((match) => match[1]);

    expect(sql).toContain('create or replace function public.delete_demo_data()');
    expect(revokeStatements.some((statement) => statement.includes('public'))).toBe(true);
    expect(revokeStatements.some((statement) => statement.includes('anon'))).toBe(true);
    expect(revokeStatements.some((statement) => statement.includes('authenticated'))).toBe(true);
    expect(sql).toMatch(
      /grant\s+execute\s+on\s+function\s+public\.delete_demo_data\(\)\s+to\s+service_role/i,
    );
  });
});
