/**
 * tenant-resolve · Supabase Edge Function (Deno)
 *
 * Resolves `(hostname, surface)` or `(tenant slug, surface)` to a tenant
 * Supabase connection blob for the
 * runtime resolver client at packages/core/services/tenantResolver.js.
 *
 * Runs inside the CONTROL-PLANE Supabase project, NOT any tenant project.
 * Reads tenant rows via service-role-only SECURITY DEFINER resolver RPCs.
 *
 * Endpoint contract (matches the resolver client):
 *   GET /tenant-resolve?host=<hostname>&surface=<patient|ops>
 *   GET /tenant-resolve?host=<hostname>&surface=<patient|ops>&slug=<tenant-slug>
 *   200 → { data: TenantConnection, error: null }
 *   400 → { data: null, error: 'INVALID_REQUEST' }
 *   403 → { data: null, error: 'SURFACE_MISMATCH' }
 *   404 → { data: null, error: 'TENANT_NOT_FOUND' }
 *   423 → { data: null, error: 'TENANT_INACTIVE' }
 *   429 → { data: null, error: 'TENANT_RESOLVER_DOWN' }
 *   503 → { data: null, error: 'TENANT_RESOLVER_DOWN' }
 *
 * NO PHI ever flows through this endpoint. Only tenant routing metadata
 * (project URL, anon key, slug, status). Service-role keys are never
 * returned.
 *
 * Deploy:
 *   supabase functions deploy tenant-resolve --no-verify-jwt
 * (--no-verify-jwt is correct: the resolver is intentionally public — anon
 *  hostnames and anon keys are public; tenant-DB RLS is the real boundary.)
 *
 * @see CONTROL_PLANE_SETUP.md §6
 * @see docs/decisions/ADR-004-domain-routing-and-control-plane-contract.md
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkEdgeRateLimit } from '../_shared/rateLimit.ts'

// ── CORS ──

const ALLOWED_ORIGINS_ENV = Deno.env.get('TENANT_RESOLVE_ALLOWED_ORIGINS') ?? '*'
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const SUCCESS_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=60'
const ERROR_CACHE_CONTROL = 'no-store'
const MAX_HOST_LENGTH = 300
const TENANT_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

function corsHeaders(origin: string | null): Record<string, string> {
  let allow: string
  if (ALLOWED_ORIGINS.includes('*')) {
    allow = '*'
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    allow = origin
  } else {
    allow = ALLOWED_ORIGINS[0] ?? '*'
  }

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

// ── Supabase client ──
// Uses the SERVICE-ROLE key to call resolve_tenant(). The service-role key
// stays on the server (Edge Function env); it is never returned in responses.

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

// ── Status mapping ──

const ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  SURFACE_MISMATCH: 403,
  TENANT_NOT_FOUND: 404,
  TENANT_INACTIVE: 423,
  TENANT_RESOLVER_DOWN: 503,
}
const PUBLIC_ERRORS = new Set(Object.keys(ERROR_STATUS))

type ResolverEnvelope = {
  data: unknown
  error: string | null
}

function normalizeHost(value: string | null): string | null {
  const host = value?.trim().toLowerCase() ?? ''
  if (!host || host.length > MAX_HOST_LENGTH) return null
  if (/[\s/@\\]/.test(host)) return null
  return host
}

function normalizeSlug(value: string | null): string | null {
  const slug = value?.trim().toLowerCase() ?? ''
  if (!slug) return null
  if (!TENANT_SLUG.test(slug)) return ''
  return slug
}

function normalizePayload(data: unknown): ResolverEnvelope {
  if (!data || typeof data !== 'object') {
    return { data: null, error: 'TENANT_RESOLVER_DOWN' }
  }

  const payload = data as { data?: unknown; error?: unknown }
  if (payload.error) {
    const errorCode = typeof payload.error === 'string' && PUBLIC_ERRORS.has(payload.error)
      ? payload.error
      : 'TENANT_RESOLVER_DOWN'
    return {
      data: null,
      error: errorCode,
    }
  }

  if (!payload.data || typeof payload.data !== 'object') {
    return { data: null, error: 'TENANT_RESOLVER_DOWN' }
  }

  const tenant = payload.data as Record<string, unknown>
  if (
    typeof tenant.tenantId !== 'string'
    || typeof tenant.slug !== 'string'
    || (tenant.surface !== 'patient' && tenant.surface !== 'ops')
    || tenant.status !== 'active'
    || typeof tenant.supabaseUrl !== 'string'
    || typeof tenant.supabaseAnonKey !== 'string'
    || typeof tenant.canonicalHost !== 'string'
  ) {
    return { data: null, error: tenant.status === 'active' ? 'TENANT_RESOLVER_DOWN' : 'TENANT_INACTIVE' }
  }

  return { data: payload.data, error: null }
}

function safeRpcErrorMetadata(surface: string, mode: string, error: unknown): Record<string, string> {
  const candidate = error && typeof error === 'object'
    ? (error as { code?: unknown }).code
    : null

  return {
    surface,
    mode,
    errorCode: typeof candidate === 'string' && candidate.trim()
      ? candidate.trim().slice(0, 80)
      : 'UNKNOWN',
  }
}

function jsonResponse(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  cacheControl: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...extraHeaders,
    },
  })
}

// ── Main handler ──

Deno.serve(async (req) => {
  const cors = corsHeaders(req.headers.get('origin'))

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  if (req.method !== 'GET') {
    return jsonResponse(
      { data: null, error: 'INVALID_REQUEST' },
      405,
      cors,
      ERROR_CACHE_CONTROL,
      { Allow: 'GET, OPTIONS' },
    )
  }

  let url: URL
  try {
    url = new URL(req.url)
  } catch (_parseError) {
    return jsonResponse(
      { data: null, error: 'INVALID_REQUEST' },
      400,
      cors,
      ERROR_CACHE_CONTROL,
    )
  }

  const host = normalizeHost(url.searchParams.get('host'))
  const surface = url.searchParams.get('surface')
  const slug = normalizeSlug(url.searchParams.get('slug'))

  if (!host || !surface) {
    return jsonResponse(
      { data: null, error: 'INVALID_REQUEST' },
      400,
      cors,
      ERROR_CACHE_CONTROL,
    )
  }

  if (surface !== 'patient' && surface !== 'ops') {
    return jsonResponse(
      { data: null, error: 'INVALID_REQUEST' },
      400,
      cors,
      ERROR_CACHE_CONTROL,
    )
  }

  if (slug === '') {
    return jsonResponse(
      { data: null, error: 'INVALID_REQUEST' },
      400,
      cors,
      ERROR_CACHE_CONTROL,
    )
  }

  const rateLimit = await checkEdgeRateLimit(supabase, {
    req,
    route: slug ? 'tenant_resolve_slug' : 'tenant_resolve',
    keyParts: [host, surface, slug ?? 'host'],
    limit: 120,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) {
    return jsonResponse(
      { data: null, error: 'TENANT_RESOLVER_DOWN' },
      rateLimit.status === 429 ? 429 : 503,
      cors,
      ERROR_CACHE_CONTROL,
      rateLimit.headers,
    )
  }

  // Call the SECURITY DEFINER RPC inside the control-plane DB.
  // It already returns the { data, error } envelope shape.
  const { data, error } = slug
    ? await supabase.rpc('resolve_tenant_by_slug', {
      p_slug: slug,
      p_surface: surface,
    })
    : await supabase.rpc('resolve_tenant', {
      p_host: host,
      p_surface: surface,
    })

  if (error) {
    console.error('resolve_tenant RPC failed', safeRpcErrorMetadata(surface, slug ? 'slug' : 'host', error))
    return jsonResponse(
      { data: null, error: 'TENANT_RESOLVER_DOWN' },
      503,
      cors,
      ERROR_CACHE_CONTROL,
    )
  }

  // resolve_tenant returns jsonb shaped as { data, error }; validate the
  // envelope defensively before returning it over the public API.
  const payload = normalizePayload(data)

  if (payload.error) {
    const status = ERROR_STATUS[payload.error] ?? 503
    return jsonResponse(payload, status, cors, ERROR_CACHE_CONTROL)
  }

  return jsonResponse(payload, 200, cors, SUCCESS_CACHE_CONTROL)
})
