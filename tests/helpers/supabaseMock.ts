import { vi } from "vitest";

/**
 * Chainable Supabase query-builder mock.
 *
 * Every terminal call resolves with `{ data: rows, error }`, but the builder
 * is also thenable so `await supabase.from(...).select(...)...eq(...)` works
 * without an explicit `.single()`. Filter methods are captured so tests can
 * assert what was queried.
 */
export type QueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

export function createSupabaseMock() {
  const calls: QueryCall[] = [];
  const state = {
    data: null as unknown,
    error: null as unknown,
    channels: [] as string[],
  };

  function makeBuilder(table: string) {
    const chain: string[] = [];
    const record = (method: string, args: unknown[]) => {
      calls.push({ table, method, args });
      chain.push(method);
    };
    const result = () => ({ data: state.data, error: state.error });
    const builder: Record<string, unknown> = {
      _table: table,
      _chain: chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    const chainable = [
      "select", "insert", "update", "delete", "upsert",
      "eq", "neq", "gt", "gte", "lt", "lte", "in", "is",
      "match", "or", "order", "limit", "range",
    ];
    for (const m of chainable) {
      builder[m] = (...args: unknown[]) => {
        record(m, args);
        return builder;
      };
    }
    const terminal = ["single", "maybeSingle"];
    for (const m of terminal) {
      builder[m] = (...args: unknown[]) => {
        record(m, args);
        return Promise.resolve(result());
      };
    }
    return builder;
  }

  const supabase = {
    from: vi.fn((table: string) => makeBuilder(table)),
    rpc: vi.fn((fn: string, args: unknown) => {
      calls.push({ table: `rpc:${fn}`, method: "rpc", args: [args] });
      return Promise.resolve({ data: state.data, error: state.error });
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: state.data as unknown }, error: state.error }),
      ),
      getSession: vi.fn(() =>
        Promise.resolve({ data: { session: state.data as unknown }, error: state.error }),
      ),
      signInWithPassword: vi.fn(() =>
        Promise.resolve({ data: null, error: state.error }),
      ),
      signUp: vi.fn(() =>
        Promise.resolve({ data: state.data, error: state.error }),
      ),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: null, error: state.error })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    channel: vi.fn((name: string) => {
      state.channels.push(name);
      const ch = {
        on: vi.fn(() => ch),
        subscribe: vi.fn(() => ch),
        unsubscribe: vi.fn(),
      };
      return ch;
    }),
    removeChannel: vi.fn(),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: null, error: null })),
        createSignedUrl: vi.fn(() =>
          Promise.resolve({ data: { signedUrl: "https://signed" }, error: null }),
        ),
      })),
    },
  };

  return {
    supabase,
    calls,
    setData: (data: unknown) => {
      state.data = data;
    },
    setError: (error: unknown) => {
      state.error = error;
    },
    reset: () => {
      state.data = null;
      state.error = null;
      calls.length = 0;
      state.channels.length = 0;
    },
    channels: state.channels,
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;