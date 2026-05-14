// Service-layer Supabase mock.
//
// Why this exists:
//   Services in packages/core/services/*.js call `supabase.from(...).select(...)`,
//   `supabase.rpc(...)`, and `supabase.auth.*`. To unit-test them with node:test
//   we need a fake client that
//     (a) matches the chainable query-builder shape supabase-js exposes, and
//     (b) lets each test prescribe what every call returns.
//
// Usage:
//   import { createSupabaseMock } from './__helpers__/supabaseMock.mjs';
//   import { __setSupabaseClientForTest } from '../../../packages/core/lib/supabase.js';
//   import { authService } from '../../../packages/core/services/auth.js';
//
//   const mock = createSupabaseMock();
//   __setSupabaseClientForTest(mock.client);
//   mock.onAuth('signInWithPassword', () => ({ data: { user: { id: 'u1' } }, error: null }));
//   mock.onFrom('users', () => ({ data: { id: 'u1', role: 'doctor' }, error: null }));
//
//   const { data, error } = await authService.signIn('a@b.com', 'pw1234567890');
//
// After each test, call __setSupabaseClientForTest(null) (or restore the previous
// client) so state does not leak between tests.

/**
 * Create a chainable query-builder fake whose terminal call (`.single()`,
 * `.maybeSingle()`, or just `await chain`) resolves to the prescribed result.
 *
 * The chain accepts every filter/modifier supabase-js exposes — eq, neq, in,
 * order, limit, range, ilike, contains, etc. — and just returns itself so the
 * service code can chain freely.
 *
 * @param {() => {data: unknown, error: unknown} | Promise<{data: unknown, error: unknown}>} resolver
 */
function makeQueryChain(resolver) {
  const resolve = () => Promise.resolve(resolver ? resolver() : { data: null, error: null });
  const chain = {};

  const passthrough = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
    'like', 'ilike', 'contains', 'containedBy', 'rangeGt', 'rangeLt',
    'rangeGte', 'rangeLte', 'rangeAdjacent', 'overlaps', 'textSearch',
    'match', 'or', 'filter', 'order', 'limit', 'range', 'returns',
    'csv', 'geojson', 'explain', 'rollback',
    'onConflict', 'ignoreDuplicates', 'count', 'head',
  ];
  for (const method of passthrough) {
    chain[method] = () => chain;
  }

  chain.single = () => resolve();
  chain.maybeSingle = () => resolve();
  chain.then = (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected);
  chain.catch = (onRejected) => resolve().catch(onRejected);
  chain.finally = (cb) => resolve().finally(cb);

  return chain;
}

const DEFAULT_NOT_MOCKED = (label) => () => ({
  data: null,
  error: new Error(`supabaseMock: no handler registered for ${label}. Call mock.on...() to prescribe a response.`),
});

/**
 * Create a fresh mock client + test helpers.
 *
 * Test helpers:
 *   mock.onAuth(methodName, handler)   — handler(args) => { data, error }
 *   mock.onFrom(tableName, handler)    — handler(call) => { data, error }
 *   mock.onRpc(rpcName, handler)       — handler(args) => { data, error }
 *
 * Inspecting calls (assertions):
 *   mock.calls.auth                    — [{ method, args }]
 *   mock.calls.from                    — [{ table, modifiers: [...], terminator }]
 *   mock.calls.rpc                     — [{ name, args }]
 */
export function createSupabaseMock() {
  const fromHandlers = new Map();
  const rpcHandlers = new Map();
  const authHandlers = new Map();

  const calls = {
    auth: [],
    from: [],
    rpc: [],
  };

  const recordFromCall = (table) => {
    const entry = { table, modifiers: [], terminator: null };
    calls.from.push(entry);
    return entry;
  };

  const buildAuth = () => new Proxy({}, {
    get(_target, method) {
      if (method === 'then' || method === Symbol.toPrimitive) return undefined;
      return (...args) => {
        calls.auth.push({ method, args });
        const handler = authHandlers.get(method);
        if (handler) return Promise.resolve(handler(...args));
        const fallback = DEFAULT_NOT_MOCKED(`auth.${String(method)}`)();
        return Promise.resolve(fallback);
      };
    },
  });

  const client = {
    auth: buildAuth(),
    from(table) {
      const callEntry = recordFromCall(table);
      const trackedHandler = () => {
        const handler = fromHandlers.get(table);
        return handler ? handler({ table, callEntry }) : DEFAULT_NOT_MOCKED(`from('${table}')`)();
      };
      const baseChain = makeQueryChain(trackedHandler);

      // Tag modifier calls so tests can assert sequence/filters used.
      const wrap = (originalMethod) => (...args) => {
        callEntry.modifiers.push({ method: originalMethod, args });
        return baseChain;
      };
      const trackedChain = { ...baseChain };
      for (const method of [
        'select', 'insert', 'update', 'upsert', 'delete',
        'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'not',
        'like', 'ilike', 'contains', 'order', 'limit', 'range',
        'onConflict', 'returns',
      ]) {
        trackedChain[method] = wrap(method);
      }
      const wrapTerminator = (name) => (...args) => {
        callEntry.terminator = { method: name, args };
        return baseChain[name](...args);
      };
      trackedChain.single = wrapTerminator('single');
      trackedChain.maybeSingle = wrapTerminator('maybeSingle');
      // Make trackedChain awaitable so service code that `await`s the query
      // (without single/maybeSingle) still works.
      trackedChain.then = baseChain.then;
      trackedChain.catch = baseChain.catch;
      trackedChain.finally = baseChain.finally;
      return trackedChain;
    },
    rpc(name, args) {
      calls.rpc.push({ name, args });
      const handler = rpcHandlers.get(name);
      if (handler) return Promise.resolve(handler(args));
      return Promise.resolve(DEFAULT_NOT_MOCKED(`rpc('${name}')`)());
    },
    channel() {
      return {
        on() { return this; },
        subscribe() { return { unsubscribe() {} }; },
        unsubscribe() {},
      };
    },
    removeChannel() {},
  };

  return {
    client,
    calls,
    onAuth(method, handler) { authHandlers.set(method, handler); },
    onFrom(table, handler) { fromHandlers.set(table, handler); },
    onRpc(name, handler) { rpcHandlers.set(name, handler); },
    reset() {
      fromHandlers.clear();
      rpcHandlers.clear();
      authHandlers.clear();
      calls.auth.length = 0;
      calls.from.length = 0;
      calls.rpc.length = 0;
    },
  };
}
