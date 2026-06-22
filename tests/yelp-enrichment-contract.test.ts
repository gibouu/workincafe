import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function readProjectFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('Yelp enrichment schema contract', () => {
  it('keeps review provenance fields in the database type contract', () => {
    const types = readProjectFile('types/database.ts');
    const reviewRow = types.match(/type ReviewRow = \{[\s\S]+?\n\};/)?.[0] ?? '';

    expect(reviewRow).toContain('source:');
    expect(reviewRow).toContain('source_weight:');
  });

  it('fails loudly on review dedup and insert errors', () => {
    const script = readProjectFile('scripts/enrich-from-yelp.ts');

    expect(script).toContain('error: enrichedErr');
    expect(script).toContain('if (enrichedErr) fail(`select existing yelp reviews: ${enrichedErr.message}`)');
    expect(script).toContain('if (insErr) fail(`insert yelp review for ${p.id}: ${insErr.message}`)');
    expect(script).not.toContain('if (!insErr) reviewsInserted++');
  });
});
