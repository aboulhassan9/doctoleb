import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkEdgeRateLimit } from './rateLimit.ts'

export const SERVICE_ROLE = 'server-only'

export type SuperAdminRole = 'owner' | 'operator' | 'support' | 'billing_admin'

export type SuperAdminContext = {
  client: SupabaseClient
  admin: {
    id: string
    auth_user_id: string
    display_name: string | null
    role: SuperAdminRole
    is_active: boolean
  }
  user: {
    id: string
    email?: string
  }
}

const DEFAULT_CONTROL_PLANE_ALLOWED_ORIGINS = [
  'https://doctoleb-control-plane.vercel.app',
  'http://localhost:3003',
  'http://127.0.0.1:3003',
]

const ALLOWED_ORIGINS_ENV = Deno.env.get('CONTROL_PLANE_ALLOWED_ORIGINS')
const ALLOWED_ORIGINS = (ALLOWED_ORIGINS_ENV ?? DEFAULT_CONTROL_PLANE_ALLOWED_ORIGINS.join(','))
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== '*')

function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true
  return ALLOWED_ORIGINS.includes(origin)
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin
    ? (isOriginAllowed(origin) ? origin : '')
    : (ALLOWED_ORIGINS[0] ?? '')

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }

  if (allowedOrigin) headers['Access-Control-Allow-Origin'] = allowedOrigin
  return headers
}

export function jsonResponse(
  body: unknown,
  status = 200,
  cors: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'content-type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      ...extraHeaders,
    },
  })
}

export function errorResponse(
  code: string,
  status: number,
  cors: Record<string, string>,
  details: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResponse({ data: null, error: code, details }, status, cors, extraHeaders)
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  const origin = req.headers.get('origin')
  if (!isOriginAllowed(origin)) {
    return errorResponse('ORIGIN_NOT_ALLOWED', 403, corsHeaders(origin))
  }

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(origin),
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export function createControlPlaneAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

function roleAllowed(role: SuperAdminRole, allowedRoles: SuperAdminRole[]) {
  if (role === 'owner') return true
  if (allowedRoles.length === 0) return true
  return allowedRoles.includes(role)
}

function rejectDisallowedOrigin(req: Request): Response | null {
  const origin = req.headers.get('origin')
  if (isOriginAllowed(origin)) return null
  return errorResponse('ORIGIN_NOT_ALLOWED', 403, corsHeaders(origin))
}

function routeNameFromRequest(req: Request): string {
  try {
    const pathname = new URL(req.url).pathname
    return pathname.split('/').filter(Boolean).at(-1) ?? 'control_plane_admin'
  } catch (_error) {
    return 'control_plane_admin'
  }
}

export async function requireSuperAdmin(
  req: Request,
  allowedRoles: SuperAdminRole[] = [],
): Promise<{ data: SuperAdminContext | null; response: Response | null }> {
  const originResponse = rejectDisallowedOrigin(req)
  if (originResponse) return { data: null, response: originResponse }

  const cors = corsHeaders(req.headers.get('origin'))
  const token = bearerToken(req)
  if (!token) {
    return { data: null, response: errorResponse('AUTH_REQUIRED', 401, cors) }
  }

  const client = createControlPlaneAdminClient()
  const { data: authData, error: authError } = await client.auth.getUser(token)
  const user = authData?.user
  if (authError || !user?.id) {
    return { data: null, response: errorResponse('AUTH_REQUIRED', 401, cors) }
  }

  const { data: admin, error } = await client
    .from('super_admins')
    .select('id, auth_user_id, display_name, role, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !admin) {
    return { data: null, response: errorResponse('FORBIDDEN', 403, cors) }
  }

  if (!roleAllowed(admin.role, allowedRoles)) {
    return { data: null, response: errorResponse('INSUFFICIENT_ROLE', 403, cors) }
  }

  const rateLimit = await checkEdgeRateLimit(client, {
    req,
    route: routeNameFromRequest(req),
    actorId: user.id,
    limit: 60,
    windowSeconds: 60,
  })
  if (!rateLimit.allowed) {
    return {
      data: null,
      response: errorResponse('RATE_LIMITED', rateLimit.status, cors, rateLimit.details, rateLimit.headers),
    }
  }

  return {
    data: {
      client,
      admin,
      user: {
        id: user.id,
        email: user.email,
      },
    },
    response: null,
  }
}

export async function readJsonBody(req: Request): Promise<Record<string, unknown>> {
  if (req.method === 'GET') return {}
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch (_error) {
    return {}
  }
}

export async function auditEvent(
  client: SupabaseClient,
  {
    tenantId,
    eventType,
    actorId,
    metadata = {},
  }: {
    tenantId?: string | null
    eventType: string
    actorId?: string | null
    metadata?: Record<string, unknown>
  },
) {
  await client.from('tenant_events').insert({
    tenant_id: tenantId ?? null,
    event_type: eventType,
    actor_id: actorId ?? null,
    metadata,
  })
}

export function tenantServiceRoleSecretName(projectRef: unknown): string {
  const normalized = typeof projectRef === 'string' ? projectRef.trim().toUpperCase() : ''
  return normalized ? `TENANT_SERVICE_ROLE_KEY_${normalized}` : 'TENANT_SERVICE_ROLE_KEY_UNCONFIGURED'
}

export function getTenantServiceRoleKey(projectRef: unknown): { key: string | null; secretName: string } {
  const secretName = tenantServiceRoleSecretName(projectRef)
  return {
    key: Deno.env.get(secretName) ?? null,
    secretName,
  }
}

export function createTenantServiceClient(tenantUrl: string, key: string): SupabaseClient {
  return createClient(tenantUrl, key, { auth: { persistSession: false } })
}
