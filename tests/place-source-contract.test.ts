import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function allMigrationSql(): string {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

describe('place_source contract', () => {
  it('allows curated and Foursquare source refs in schema and generated types', () => {
    const sql = allMigrationSql().toLowerCase();
    const types = readProjectFile('types/database.ts');

    expect(sql).toContain("'curated'");
    expect(sql).toContain("'foursquare'");
    expect(types).toMatch(/export type PlaceSource = .*'curated'.*'foursquare'/);
  });

  it('fails seed scripts when source-ref upserts are rejected', () => {
    const curatedSeeder = readProjectFile('scripts/seed-curated-workspaces.ts');
    const mallSeeder = readProjectFile('scripts/seed-mall-children.ts');

    expect(curatedSeeder).toContain("source: 'curated'");
    expect(curatedSeeder).toMatch(/if\s*\(\s*refsErr\s*\)\s*throw\s+refsErr/);

    expect(mallSeeder).toContain("source: 'foursquare'");
    expect(mallSeeder).toMatch(/if\s*\(\s*mallRefErr\s*\)\s*{/);
    expect(mallSeeder).toMatch(/if\s*\(\s*childRefsErr\s*\)\s*{/);
  });
});
