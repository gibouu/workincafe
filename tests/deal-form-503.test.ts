import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DealForm API error handling', () => {
  it('does not treat 503 deal saves as successful redirects', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'components/owner/DealForm.tsx'),
      'utf8',
    );

    expect(source).toContain('if (!resp.ok) {');
    expect(source).not.toContain('resp.status !== 503');
  });
});
