import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('decide_flagged_review migration', () => {
  it('decides review flags and moderation side effects inside one RPC', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '20260623195000_decide_flagged_review_rpc.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain('create or replace function public.decide_flagged_review');
    expect(sql).toContain("where id = p_flag_id");
    expect(sql).toContain("and status = 'pending'");
    expect(sql).toContain('raise exception \'flag already decided\'');
    expect(sql).toContain('raise exception \'underlying review missing\'');
    expect(sql).toContain('update public.reviews');
    expect(sql).toContain('update public.users');
    expect(sql).toContain('revoke all on function public.decide_flagged_review');
    expect(sql).toContain('grant execute on function public.decide_flagged_review');
  });
});
