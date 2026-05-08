import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const ALLOWED_ORIGINS_ENV = Deno.env.get('CONTROL_PLANE_ALLOWED_ORIGINS') ?? '*'
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

export function corsHeaders(origin: string | null): Record<string, string> {
  let allow = '*'
  if (!ALLOWED_ORIGINS.includes('*')) {
    allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : (ALLOWED_ORIGINS[0] ?? '')
  }

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  }
}

export function jsonResponse(
  body: unknown,
  status = 200,
  cors: Record<string, string> = {},
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
    },
  })
}

export function errorResponse(
  code: string,
  status: number,
  cors: Record<string, string>,
  details: Record<string, unknown> = {},
): Response {
  return jsonResponse({ data: null, error: code, details }, status, cors)
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(req.headers.get('origin')),
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

export async function requireSuperAdmin(
  req: Request,
  allowedRoles: SuperAdminRole[] = [],
): Promise<{ data: SuperAdminContext | null; response: Response | null }> {
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
