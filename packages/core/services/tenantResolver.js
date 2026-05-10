/**
 * tenantResolver.js — Browser-side client for the tenant resolver endpoint.
 *
 * Maps `(host, surface)` to a tenant Supabase connection blob. Returns the
 * standard `{ data, error }` envelope so callers (TenantBootstrap) treat
 * resolver failures the same way as any other service failure.
 *
 * In DEV with `VITE_DEV_TENANT_SLUG` set, the resolver synthesizes a response
 * from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and never hits the
 * network. In PROD the env fallback is disabled — calls fail closed.
 *
 * @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
 */

import { isRuntimeDev, isRuntimeProd, readRuntimeEnv } from '../lib/env.js';
import { isValidTenantSlug } from '../lib/hostnameSurface.js';

// ── Error codes (stable contract; UI maps to copy) ──

export const RESOLVER_ERRORS = Object.freeze({
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',          // 404 — hostname not mapped
  SURFACE_MISMATCH: 'SURFACE_MISMATCH',          // 403 — host belongs to other surface
  TENANT_INACTIVE: 'TENANT_INACTIVE',            // 423 — suspended/maintenance
  TENANT_RESOLVER_DOWN: 'TENANT_RESOLVER_DOWN',  // 503 — control plane unreachable
  INVALID_REQUEST: 'INVALID_REQUEST',            // 400 — caller bug
  RESOLVER_NOT_CONFIGURED: 'RESOLVER_NOT_CONFIGURED', // no endpoint + no DEV fallback
});

// ── Cache (in-memory, per session, bounded LRU) ──

const SUCCESS_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const ERROR_TTL_MS = 30 * 1000;         // 30 seconds
const MAX_CACHE_ENTRIES = 64;           // bound the Map so adversarial hosts can't grow it without limit
const DEFAULT_RESOLVER_TIMEOUT_MS = 6000;
const MIN_RESOLVER_TIMEOUT_MS = 1000;
const MAX_RESOLVER_TIMEOUT_MS = 30000;

const _cache = new Map();

function cacheKey(host, surface, slug = null) {
  const mode = slug ? `slug:${slug.toLowerCase()}` : 'host';
  return `${(host || '').toLowerCase()}::${surface}::${mode}`;
}

function readCache(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  // Refresh recency for LRU semantics — Map preserves insertion order.
  _cache.delete(key);
  _cache.set(key, entry);
  return entry.value;
}

function writeCache(key, value, ttlMs) {
  if (_cache.has(key)) _cache.delete(key);
  _cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (_cache.size > MAX_CACHE_ENTRIES) {
    // Evict the oldest entry (Map iterates in insertion order).
    const oldestKey = _cache.keys().next().value;
    if (oldestKey !== undefined) _cache.delete(oldestKey);
  }
}

/** Test/diagnostic helper — clears all cached resolutions. */
export function clearResolverCache() {
  _cache.clear();
}

// ── DEV fallback ──

function devFallback({ host, surface, slug: requestedSlug = null }) {
  const url = readRuntimeEnv('VITE_SUPABASE_URL');
  const anonKey = readRuntimeEnv('VITE_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return null;
  }

  // Slug is optional in DEV — defaults to 'dev' so existing local .env files
  // (with only VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY) keep working
  // unchanged. Set VITE_DEV_TENANT_SLUG when testing tenant-specific UX.
  const slug = requestedSlug || readRuntimeEnv('VITE_DEV_TENANT_SLUG') || 'dev';

  return {
    tenantId: `dev-${slug}`,
    slug,
    surface,
    status: 'active',
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
    schemaVersion: readRuntimeEnv('VITE_DEV_SCHEMA_VERSION') || 'dev',
    canonicalHost: host || `${slug}.localhost`,
  };
}

// ── HTTP path ──

function buildResolverUrl({ host, surface, slug = null }) {
  const baseUrl = readRuntimeEnv('VITE_TENANT_RESOLVER_URL');
  if (!baseUrl) return null;

  const trimmed = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({ host, surface });
  if (slug) params.set('slug', slug);
  return `${trimmed}?${params.toString()}`;
}

function readResolverTimeoutMs() {
  const raw = readRuntimeEnv('VITE_TENANT_RESOLVER_TIMEOUT_MS');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_RESOLVER_TIMEOUT_MS;
  return Math.min(MAX_RESOLVER_TIMEOUT_MS, Math.max(MIN_RESOLVER_TIMEOUT_MS, parsed));
}

function createResolverSignal(parentSignal) {
  if (typeof AbortController === 'undefined') {
    return { signal: parentSignal, cleanup: () => {} };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), readResolverTimeoutMs());
  const abortFromParent = () => controller.abort(parentSignal?.reason);

  if (parentSignal) {
    if (parentSignal.aborted) {
      abortFromParent();
    } else {
      parentSignal.addEventListener('abort', abortFromParent, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener('abort', abortFromParent);
    },
  };
}

function mapStatusToError(status) {
  switch (status) {
    case 400: return RESOLVER_ERRORS.INVALID_REQUEST;
    case 403: return RESOLVER_ERRORS.SURFACE_MISMATCH;
    case 404: return RESOLVER_ERRORS.TENANT_NOT_FOUND;
    case 423: return RESOLVER_ERRORS.TENANT_INACTIVE;
    case 503: return RESOLVER_ERRORS.TENANT_RESOLVER_DOWN;
    default: return RESOLVER_ERRORS.TENANT_RESOLVER_DOWN;
  }
}

async function fetchResolver({ host, surface, slug = null, signal }) {
  const url = buildResolverUrl({ host, surface, slug });
  if (!url) return null; // no endpoint configured

  const resolverSignal = createResolverSignal(signal);
  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: resolverSignal.signal,
      credentials: 'omit',
    });
  } catch (_networkError) {
    return { data: null, error: RESOLVER_ERRORS.TENANT_RESOLVER_DOWN };
  } finally {
    resolverSignal.cleanup();
  }

  if (!response.ok) {
    return { data: null, error: mapStatusToError(response.status) };
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_parseError) {
    return { data: null, error: RESOLVER_ERRORS.TENANT_RESOLVER_DOWN };
  }

  // Endpoint must already speak the { data, error } envelope
  if (payload && typeof payload === 'object' && ('data' in payload || 'error' in payload)) {
    return {
      data: payload.data ?? null,
      error: payload.error ?? null,
    };
  }

  // Tolerate a flat object (older endpoint shape) by treating it as data
  if (payload && typeof payload === 'object' && payload.tenantId) {
    return { data: payload, error: null };
  }

  return { data: null, error: RESOLVER_ERRORS.TENANT_RESOLVER_DOWN };
}

// ── Validation ──

function normalizeSlug(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function validateRequest({ host, surface, slug = null }) {
  if (typeof host !== 'string' || host.length === 0) {
    return RESOLVER_ERRORS.INVALID_REQUEST;
  }
  if (surface !== 'patient' && surface !== 'ops') {
    return RESOLVER_ERRORS.INVALID_REQUEST;
  }
  if (slug !== null && !isValidTenantSlug(slug)) {
    return RESOLVER_ERRORS.INVALID_REQUEST;
  }
  return null;
}

function validateResponse(data, requestedSurface) {
  if (!data || typeof data !== 'object') {
    return RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED;
  }
  if (!data.supabaseUrl || !data.supabaseAnonKey || !data.tenantId) {
    return RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED;
  }
  if (data.surface && data.surface !== requestedSurface) {
    return RESOLVER_ERRORS.SURFACE_MISMATCH;
  }
  if (data.status && data.status !== 'active') {
    return RESOLVER_ERRORS.TENANT_INACTIVE;
  }
  return null;
}

// ── Public API ──

export const tenantResolverService = {
  /**
   * Resolve a tenant connection for the given host + surface.
   *
   * Returns `{ data: TenantConnection, error: null }` on success,
   * `{ data: null, error: <RESOLVER_ERROR> }` on failure.
   *
   * Caching:
   * - Successful resolutions are cached for 5 minutes per (host, surface).
   * - Errors are cached for 30 seconds to avoid hammering during outages.
   * - Use `clearResolverCache()` in tests.
   *
   * @param {{ host: string, surface: 'patient'|'ops', slug?: string|null, signal?: AbortSignal }} request
   * @returns {Promise<{ data: object|null, error: string|null }>}
   */
  async resolve({ host, surface, slug = null, signal } = {}) {
    const normalizedSlug = normalizeSlug(slug);
    const validationError = validateRequest({ host, surface, slug: normalizedSlug });
    if (validationError) {
      return { data: null, error: validationError };
    }

    const key = cacheKey(host, surface, normalizedSlug);
    const cached = readCache(key);
    if (cached) return cached;

    // 1. Try real resolver endpoint if configured.
    const httpResult = await fetchResolver({ host, surface, slug: normalizedSlug, signal });
    if (httpResult && httpResult.data) {
      const responseError = validateResponse(httpResult.data, surface);
      if (!responseError) {
        const value = { data: httpResult.data, error: null };
        writeCache(key, value, SUCCESS_TTL_MS);
        return value;
      }

      const value = { data: null, error: responseError };
      writeCache(key, value, ERROR_TTL_MS);
      if (!isRuntimeDev()) return value;
    }
    if (httpResult && httpResult.error) {
      const value = { data: null, error: httpResult.error };
      writeCache(key, value, ERROR_TTL_MS);
      // In dev, fall through to env fallback even when the endpoint says
      // 404 — local-only flows shouldn't require a control plane.
      if (!isRuntimeDev()) return value;
    }

    // 2. DEV fallback from env.
    if (!isRuntimeProd()) {
      const fallback = devFallback({ host, surface, slug: normalizedSlug });
      if (fallback) {
        const value = { data: fallback, error: null };
        writeCache(key, value, SUCCESS_TTL_MS);
        return value;
      }
    }

    // 3. Production with no endpoint configured AND no DEV fallback — fail closed.
    const value = {
      data: null,
      error: httpResult?.error || RESOLVER_ERRORS.RESOLVER_NOT_CONFIGURED,
    };
    writeCache(key, value, ERROR_TTL_MS);
    return value;
  },
};
