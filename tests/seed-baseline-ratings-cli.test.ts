import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('seed-baseline-ratings city arguments', () => {
  it('rejects an empty --city value before loading Supabase env', () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'scripts/seed-baseline-ratings.ts', '--city='],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unsupported --city value');
    expect(result.stderr).not.toContain('NEXT_PUBLIC_SUPABASE_URL is missing');
  });
});
