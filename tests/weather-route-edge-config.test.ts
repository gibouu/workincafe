import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('weather edge route config', () => {
  it('does not export time-based revalidation from an edge route', () => {
    const source = readFileSync(path.join(process.cwd(), 'app/api/weather/route.ts'), 'utf8');

    expect(source).toContain("export const runtime = 'edge'");
    expect(source).not.toMatch(/export\s+const\s+revalidate\s*=/);
  });
});
