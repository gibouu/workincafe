import { describe, expect, it } from 'vitest';
import { callsFor, createMockClient } from './helpers/mock-supabase';
import { resolvePlaceIdForActor } from '@/lib/auth/request-actor';

describe('resolvePlaceIdForActor', () => {
  it('re-reads demo places after a concurrent insert conflict', async () => {
    const persistedId = '00000000-0000-0000-0000-000000000044';
    const db = createMockClient({
      tables: {
        places: [
          { data: null, error: null },
          { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } },
          { data: { id: persistedId }, error: null },
        ],
      },
    });

    const result = await resolvePlaceIdForActor(db, 'ten-belles', true);

    expect(result).toBe(persistedId);
    expect(callsFor(db, 'places', 'eq').map((call) => call.args)).toEqual([
      ['normalized_name_hash', 'demo:ten-belles'],
      ['normalized_name_hash', 'demo:ten-belles'],
    ]);
  });
});
