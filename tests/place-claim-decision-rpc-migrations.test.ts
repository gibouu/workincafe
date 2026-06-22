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

describe('decide_place_claim migration', () => {
  it('claims the pending row before granting ownership', () => {
    const sql = allMigrationSql();

    expect(sql).toContain('create or replace function public.decide_place_claim');
    expect(sql).toMatch(/where\s+id\s+=\s+p_claim_id[\s\S]+and\s+status\s+=\s+'pending'[\s\S]+returning\s+\*/i);
    expect(sql).toMatch(/if\s+not\s+found[\s\S]+claim already decided/i);
    expect(sql).toMatch(/if\s+p_decision\s+=\s+'approved'[\s\S]+insert\s+into\s+public\.place_owners/i);
  });
});
