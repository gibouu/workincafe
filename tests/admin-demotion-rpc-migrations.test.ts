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

describe('set_user_admin_status migration', () => {
  it('serializes admin demotions and rejects removing the final admin', () => {
    const sql = allMigrationSql();

    expect(sql).toContain('create or replace function public.set_user_admin_status');
    expect(sql).toMatch(/pg_advisory_xact_lock\([\s\S]*set_user_admin_status/i);
    expect(sql).toMatch(/update\s+public\.users[\s\S]+set\s+is_admin\s*=\s*p_promote[\s\S]+where\s+id\s*=\s*p_target_id/i);
    expect(sql).toContain('if not exists (select 1 from public.users where is_admin is true) then');
    expect(sql).toContain("raise exception 'you''re the only admin - promote someone else first'");
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.set_user_admin_status\(uuid,\s*boolean,\s*uuid\)\s+to\s+service_role/i);
  });
});
