import { vi } from 'vitest';

export interface QueryResult {
  data: unknown;
  error: unknown;
}

export interface RecordedCall {
  table: string;
  method: string;
  args: unknown[];
}

export interface MockClientOptions {
  /**
   * Per-table results. An array is a FIFO consumed once per `.from(table)`
   * call (for code that hits the same table twice, e.g. select then
   * update); a bare object is reused for every call.
   */
  tables?: Record<string, QueryResult | QueryResult[]>;
  /** Payload for `auth.admin.listUsers()`. */
  listUsers?: { users: { id: string; email: string | null }[] };
}

const CHAIN_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'not',
  'is',
  'in',
  'gte',
  'lte',
  'gt',
  'lt',
  'ilike',
  'or',
  'order',
  'limit',
  'range',
] as const;

export interface MockClient {
  from: (table: string) => unknown;
  rpc: ReturnType<typeof vi.fn>;
  auth: { admin: { listUsers: ReturnType<typeof vi.fn> } };
  calls: RecordedCall[];
}

/**
 * Chainable thenable that mimics the supabase-js query builder. Every
 * builder method records (table, method, args) into `calls` and returns
 * the chain; awaiting the chain (or `.maybeSingle()` / `.single()`)
 * resolves to the result queued for that table.
 */
export function createMockClient(opts: MockClientOptions = {}): MockClient {
  const queues = new Map<string, QueryResult[]>();
  const reusable = new Map<string, QueryResult>();
  for (const [table, r] of Object.entries(opts.tables ?? {})) {
    if (Array.isArray(r)) queues.set(table, [...r]);
    else reusable.set(table, r);
  }
  const calls: RecordedCall[] = [];

  const nextResult = (table: string): QueryResult => {
    const q = queues.get(table);
    if (q && q.length > 0) return q.shift() as QueryResult;
    return reusable.get(table) ?? { data: null, error: null };
  };

  const makeChain = (table: string) => {
    const result = nextResult(table);
    type ChainFn = (...args: unknown[]) => unknown;
    const chain: Record<string, ChainFn> = {};
    for (const method of CHAIN_METHODS) {
      chain[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return chain;
      };
    }
    chain.maybeSingle = () => {
      calls.push({ table, method: 'maybeSingle', args: [] });
      return Promise.resolve(result);
    };
    chain.single = () => {
      calls.push({ table, method: 'single', args: [] });
      return Promise.resolve(result);
    };
    chain.then = (onFulfilled?: unknown, onRejected?: unknown) =>
      Promise.resolve(result).then(
        onFulfilled as ((v: QueryResult) => unknown) | undefined,
        onRejected as ((e: unknown) => unknown) | undefined,
      );
    return chain;
  };

  return {
    from: (table: string) => {
      calls.push({ table, method: 'from', args: [] });
      return makeChain(table);
    },
    rpc: vi.fn(async () => ({ data: null, error: null })),
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: opts.listUsers ?? { users: [] },
          error: null,
        })),
      },
    },
    calls,
  };
}

/** All recorded calls for a given table + method, in order. */
export function callsFor(client: MockClient, table: string, method: string): RecordedCall[] {
  return client.calls.filter((c) => c.table === table && c.method === method);
}

/** Convenience: an actor object in the shape getRequestActor resolves to. */
export function actorOf(client: MockClient, user: { id: string; email: string | null } | null) {
  return {
    db: client,
    supabase: client,
    user: user ? { ...user, name: null, isDemo: false } : null,
    isDemo: false,
  };
}
