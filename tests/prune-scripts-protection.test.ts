import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRUNE_SCRIPTS = [
  'scripts/prune-apartment-residences.ts',
  'scripts/prune-non-work-conducive.ts',
];

describe('destructive prune script protection lookups', () => {
  it('protects checkins and fails closed on contribution lookup errors', () => {
    for (const path of PRUNE_SCRIPTS) {
      const source = readFileSync(join(process.cwd(), path), 'utf8');

      expect(source).toContain("['reviews', 'checkins', 'live_updates']");
      expect(source).not.toContain('check_ins');
      expect(source).toContain("fail(`select ${table}: ${message || JSON.stringify(error)}`)");
      expect(source).not.toContain('skipping protection lookup for missing table');
      expect(source).not.toContain('PGRST205');
    }
  });
});
