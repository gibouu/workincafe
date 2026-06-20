import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('approve_place_request migration', () => {
  it('claims a pending request before inserting the approved place', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '20260620131000_approve_place_request_rpc.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain('create or replace function public.approve_place_request');
    expect(sql).toMatch(/update\s+public\.place_requests[\s\S]+and\s+status\s*=\s*'pending'[\s\S]+returning\s+\*\s+into\s+v_req/i);
    expect(sql).toContain('insert into public.places');
    expect(sql.indexOf('update public.place_requests')).toBeLessThan(
      sql.indexOf('insert into public.places'),
    );
    expect(sql).toContain("raise exception 'request already decided'");
    expect(sql).toContain('revoke all on function public.approve_place_request');
  });
});
