/**
 * supabase.js — Runtime Supabase client factory.
 *
 * Replaces the old static `createClient(...)` singleton with:
 *   - `configureSupabaseClient({ url, anonKey })` — install at runtime, idempotent
 *   - `getSupabaseClient()` — read the configured client (throws if not configured)
 *   - `supabase` — Proxy compat shim so existing `import { supabase }` keeps working
 *
 * The Proxy lets every existing service file continue to call
 *   `supabase.from(...)`, `supabase.rpc(...)`, `supabase.auth.*`, `supabase.channel(...)`
 * without any rewrite. Each call routes through `getSupabaseClient()`.
 *
 * Bootstrap order (per ADR-004):
 *   1. classifyHostname(window.location.host)
 *   2. tenantResolverService.resolve({ host, surface })
 *   3. configureSupabaseClient({ url, anonKey })
 *   4. mount AuthProvider/BrandProvider — service calls now work
 *
 * In DEV, `<TenantBootstrap>` synthesizes the resolver result from
 * VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY, so existing local flows are
 * unchanged.
 *
 * @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
 */

import { createClient } from '@supabase/supabase-js';

// ── Module-scoped client state ──

let _client = null;
let _config = null;   // { url, anonKey } — last configured values, for idempotency

// ── Public factory API ──

/**
 * Install the Supabase client for this app instance. Idempotent: passing the
 * same `{ url, anonKey }` returns the existing client without recreating it,
 * which prevents Realtime/auth subscriptions from being torn down on
 * re-renders or hot-reloads.
 *
 * @param {{ url: string, anonKey: string, options?: object }} config
 * @returns {ReturnType<typeof createClient>}
 */
export function configureSupabaseClient({ url, anonKey, options } = {}) {
  if (typeof url !== 'string' || url.length === 0) {
    throw new Error('configureSupabaseClient: `url` is required.');
  }
  if (typeof anonKey !== 'string' || anonKey.length === 0) {
    throw new Error('configureSupabaseClient: `anonKey` is required.');
  }

  if (_client && _config && _config.url === url && _config.anonKey === anonKey) {
    return _client;
  }

  _client = createClient(url, anonKey, options);
  _config = { url, anonKey };
  return _client;
}

/**
 * Read the currently configured Supabase client. Throws if
 * `configureSupabaseClient` has not been called yet, which surfaces ordering
 * bugs immediately rather than allowing a service to silently use a stale
 * (or no) client.
 *
 * @returns {ReturnType<typeof createClient>}
 */
export function getSupabaseClient() {
  if (!_client) {
    throw new Error(
      'Supabase client not configured. ' +
      'Wrap the app in <TenantBootstrap> or call configureSupabaseClient() before any service.'
    );
  }
  return _client;
}

/**
 * TEST-ONLY: replace the configured Supabase client with a mock for unit tests.
 *
 * Production code MUST go through `configureSupabaseClient({ url, anonKey })`
 * which calls `createClient()` against a real Supabase project. This setter
 * exists so service-layer unit tests can inject a chainable fake client
 * (see tests/unit/services/__helpers__/supabaseMock.mjs) without standing up
 * a network or refactoring every service to accept a client parameter.
 *
 * Returns the previous client (or null) so callers can restore it.
 *
 * @param {object|null} client - Mock client matching the supabase-js shape.
 * @returns {object|null}
 */
export function __setSupabaseClientForTest(client) {
  const previous = _client;
  _client = client;
  _config = client ? { url: 'test', anonKey: 'test' } : null;
  return previous;
}

// ── Compatibility shim ──
//
// Existing services and contexts import `supabase` directly:
//   import { supabase } from '@/lib/supabase';
//   await supabase.from('patients').select(...);
//
// The Proxy below routes property access to whichever client is currently
// configured. Once a service has called e.g. `supabase.from(...)`, the
// returned query builder is a regular object (not a Proxy), so subsequent
// chaining is normal — the Proxy only intercepts the FIRST property access.

const supabaseShim = new Proxy(Object.freeze({}), {
  get(_target, prop) {
    if (prop === Symbol.toPrimitive) return undefined;
    if (prop === 'toString') return () => '[SupabaseClientProxy]';
    if (prop === Symbol.toStringTag) return 'SupabaseClientProxy';
    const client = getSupabaseClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, prop) {
    return prop in getSupabaseClient();
  },
  ownKeys() {
    return Object.keys(getSupabaseClient());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getSupabaseClient(), prop);
  },
});

export { supabaseShim as supabase };
