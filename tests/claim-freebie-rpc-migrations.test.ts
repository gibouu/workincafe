import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('claim_freebie_purchase migration', () => {
  it('issues the freebie ticket and spends points inside one locked RPC', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '20260619170000_claim_freebie_purchase_rpc.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain('create or replace function public.claim_freebie_purchase');
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('claim_freebie_purchase:'");
    expect(sql).toContain('insert into public.deal_purchases');
    expect(sql).toContain('insert into public.point_events');
    expect(sql).toContain("'spent_freebie'");
    expect(sql).toContain('raise exception \'freebie not unlocked\'');
    expect(sql).toContain('revoke all on function public.claim_freebie_purchase');
  });
});
