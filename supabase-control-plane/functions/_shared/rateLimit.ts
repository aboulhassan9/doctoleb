import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type RateLimitResult = {
  allowed: boolean
  status: number
  headers: Record<string, string>
  details: Record<string, unknown>
}

type RateLimitOptions = {
  req: Request
  route: string
  actorId?: string | null
  keyParts?: Array<string | null | undefined>
  limit?: number
  windowSeconds?: number
}

const DEFAULT_LIMIT = 60
const DEFAULT_WINDOW_SECONDS = 60

function normalizeRoute(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || 'edge_function'
}

function firstForwardedIp(req: Request): string {
  const candidates = [
    req.headers.get('cf-connecting-ip'),
    req.headers.get('x-real-ip'),
    req.headers.get('x-forwarded-for')?.split(',')[0],
  ]

  return candidates
    .map((value) => value?.trim())
    .find(Boolean) ?? 'unknown'
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.max(min, Math.min(numberValue, max))
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function rateLimitHeaders(limit: number, remaining: number, retryAfterSeconds: number): Record<string, string> {
  return {
    'Retry-After': String(retryAfterSeconds),
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(remaining, 0)),
  }
}

export async function checkEdgeRateLimit(
  client: SupabaseClient,
  {
    req,
    route,
    actorId = null,
    keyParts = [],
    limit = DEFAULT_LIMIT,
    windowSeconds = DEFAULT_WINDOW_SECONDS,
  }: RateLimitOptions,
): Promise<RateLimitResult> {
  const normalizedRoute = normalizeRoute(route)
  const normalizedLimit = safeNumber(limit, DEFAULT_LIMIT, 1, 10_000)
  const normalizedWindow = safeNumber(windowSeconds, DEFAULT_WINDOW_SECONDS, 10, 3600)
  const salt = Deno.env.get('EDGE_RATE_LIMIT_SALT') || Deno.env.get('SUPABASE_URL') || 'doctoleb-edge-rate-limit'
  const principal = actorId?.trim() || firstForwardedIp(req)
  const keyMaterial = [
    salt,
    normalizedRoute,
    principal,
    ...keyParts.map((part) => String(part ?? '').trim().toLowerCase()).filter(Boolean),
  ].join('|')
  const keyHash = await sha256Hex(keyMaterial)

  const { data, error } = await client.rpc('check_edge_rate_limit', {
    p_route: normalizedRoute,
    p_key_hash: keyHash,
    p_limit: normalizedLimit,
    p_window_seconds: normalizedWindow,
  })

  if (error || !data || typeof data !== 'object') {
    return {
      allowed: false,
      status: 503,
      headers: rateLimitHeaders(normalizedLimit, 0, normalizedWindow),
      details: {
        route: normalizedRoute,
        reason: 'RATE_LIMIT_CHECK_FAILED',
      },
    }
  }

  const payload = data as {
    data?: {
      allowed?: unknown
      limit?: unknown
      remaining?: unknown
      retryAfterSeconds?: unknown
    }
    error?: unknown
  }

  if (payload.error || !payload.data || payload.data.allowed !== true) {
    const retryAfterSeconds = safeNumber(payload.data?.retryAfterSeconds, normalizedWindow, 1, 3600)
    const remaining = safeNumber(payload.data?.remaining, 0, 0, normalizedLimit)

    return {
      allowed: false,
      status: 429,
      headers: rateLimitHeaders(normalizedLimit, remaining, retryAfterSeconds),
      details: {
        route: normalizedRoute,
        reason: typeof payload.error === 'string' ? payload.error : 'RATE_LIMITED',
      },
    }
  }

  const responseLimit = safeNumber(payload.data.limit, normalizedLimit, 1, 10_000)
  const remaining = safeNumber(payload.data.remaining, normalizedLimit, 0, responseLimit)

  return {
    allowed: true,
    status: 200,
    headers: rateLimitHeaders(responseLimit, remaining, 1),
    details: {
      route: normalizedRoute,
    },
  }
}
