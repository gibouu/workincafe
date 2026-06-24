import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Foursquare enrichment contract', () => {
  it('fails loudly when place backfill writes fail', () => {
    const script = readProjectFile('scripts/enrich-from-foursquare.ts');

    expect(script).toContain('if (updErr) fail(`update foursquare place fields for ${p.id}: ${updErr.message}`)');
    expect(script).toContain('updated++;');
    expect(script).not.toContain('if (!updErr) updated++');
  });
});
