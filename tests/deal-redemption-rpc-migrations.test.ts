import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function allMigrationSql(): string {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n')
    .toLowerCase();
}

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

  it('awards loyalty points inside the redemption transaction', () => {
    const sql = allMigrationSql();
    const redeemFunctions = [...sql.matchAll(
      /create or replace function public\.redeem_deal_purchase[\s\S]+?revoke all on function public\.redeem_deal_purchase/g,
    )].map((match) => match[0]);
    const latestRedeemFunction = redeemFunctions.at(-1) ?? '';

    expect(latestRedeemFunction).toMatch(/insert\s+into\s+public\.point_events/i);
    expect(latestRedeemFunction).toContain("'earned_use'");
    expect(latestRedeemFunction).toMatch(/related_use_id[\s\S]+v_use_id/i);
    expect(latestRedeemFunction).toMatch(/related_purchase_id[\s\S]+p_purchase_id/i);
  });
});
