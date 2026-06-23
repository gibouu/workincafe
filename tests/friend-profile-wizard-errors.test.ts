import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('FriendProfileWizard save errors', () => {
  it('treats all non-OK save responses as failures', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'components/friends/FriendProfileWizard.tsx'),
      'utf8',
    );

    expect(source).toContain('if (!resp.ok) {');
    expect(source).not.toContain('resp.status !== 503');
  });
});
