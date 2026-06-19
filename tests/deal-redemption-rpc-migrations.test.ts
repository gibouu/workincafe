import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('redeem_deal_purchase migration', () => {
  it('decrements the current database counter inside the redemption RPC', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase',
        'migrations',
        '20260619135000_redeem_deal_purchase_rpc.sql',
      ),
      'utf8',
    ).toLowerCase();

    expect(sql).toContain('create or replace function public.redeem_deal_purchase');
    expect(sql).toContain('set uses_remaining = deal_purchases.uses_remaining - 1');
    expect(sql).not.toContain('ticket.uses_remaining - 1');
    expect(sql).not.toContain('updated.uses_remaining + 1');
    expect(sql).toMatch(/insert\s+into\s+public\.deal_uses[\s\S]+returning\s+id\s+into\s+v_use_id/i);
  });
});
