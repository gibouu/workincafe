import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin users page', () => {
  it('renders RPC load failures separately from a legitimate empty admin list', () => {
    const source = readFileSync(
      join(process.cwd(), 'app', 'admin', 'users', 'page.tsx'),
      'utf8',
    );

    expect(source).toContain('error: adminErr');
    expect(source).toContain('adminLoadError');
    expect(source).toContain('Unable to load admins');
    expect(source).toMatch(/adminLoadError\s+\?\s*\(/);
    expect(source).toMatch(/:\s+admins\.length\s+===\s+0\s+\?\s*\(/);
  });
});
