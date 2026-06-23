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

describe('review geo trust migrations', () => {
  it('prevents authenticated clients from writing trusted review geo fields', () => {
    const sql = allMigrationSql();

    expect(sql).toContain('create or replace function public.prevent_client_review_geo_trust()');
    expect(sql).toContain("current_user in ('anon', 'authenticated')");
    expect(sql).toMatch(/new\.geo_verified\s*:=\s*false/i);
    expect(sql).toMatch(/new\.verified_lat\s*:=\s*null/i);
    expect(sql).toMatch(/new\.verified_lng\s*:=\s*null/i);
    expect(sql).toMatch(
      /create\s+policy\s+"reviews_insert_own"\s+on\s+public\.reviews\s+for\s+insert\s+to\s+authenticated\s+with\s+check\s*\([\s\S]*geo_verified\s+is\s+false[\s\S]*verified_lat\s+is\s+null[\s\S]*verified_lng\s+is\s+null[\s\S]*\)/i,
    );
  });

  it('preserves trusted review geo fields on direct authenticated updates', () => {
    const sql = allMigrationSql();

    expect(sql).toMatch(/new\.geo_verified\s*:=\s*old\.geo_verified/i);
    expect(sql).toMatch(/new\.verified_lat\s*:=\s*old\.verified_lat/i);
    expect(sql).toMatch(/new\.verified_lng\s*:=\s*old\.verified_lng/i);
    expect(sql).toMatch(
      /create\s+trigger\s+reviews_client_geo_trust_guard\s+before\s+insert\s+or\s+update\s+of\s+geo_verified\s*,\s*verified_lat\s*,\s*verified_lng\s+on\s+public\.reviews/i,
    );
  });
});
