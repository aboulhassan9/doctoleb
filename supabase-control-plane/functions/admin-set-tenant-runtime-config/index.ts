import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'

const PROJECT_REF = /^[a-z0-9]{20}$/
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  TENANT_NOT_FOUND: 404,
  TENANT_RUNTIME_CONFIG_SAVE_FAILED: 500,
}

function normalizeProjectRef(value: unknown) {
  const projectRef = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return PROJECT_REF.test(projectRef) ? projectRef : ''
}

function normalizeSupabaseUrl(value: unknown, projectRef: string) {
  if (typeof value !== 'string') return ''

  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return ''
    if (url.username || url.password || url.search || url.hash) return ''
    if (url.hostname !== `${projectRef}.supabase.co`) return ''
    return `https://${url.hostname}`
  } catch (_error) {
    return ''
  }
}

function normalizeAnonKey(value: unknown) {
  const anonKey = typeof value === 'string' ? value.trim() : ''
  if (anonKey.length < 20 || anonKey.length > 4096) return ''
  if (/\s/.test(anonKey)) return ''
  return anonKey
}

function statusForRpcError(code: string) {
  return RPC_ERROR_STATUS[code] ?? 500
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST' && req.method !== 'PATCH') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''
  const projectRef = normalizeProjectRef(body.supabaseProjectRef ?? body.supabase_project_ref)
  const supabaseUrl = normalizeSupabaseUrl(body.supabaseUrl ?? body.supabase_url, projectRef)
  const supabaseAnonKey = normalizeAnonKey(body.supabaseAnonKey ?? body.supabase_anon_key)

  if (!tenantId || !projectRef || !supabaseUrl || !supabaseAnonKey) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const { data: rpcPayload, error: rpcError } = await context.client.rpc('admin_set_tenant_runtime_config_atomic', {
    p_actor_id: context.admin.id,
    p_tenant_id: tenantId,
    p_supabase_project_ref: projectRef,
    p_supabase_url: supabaseUrl,
    p_supabase_anon_key: supabaseAnonKey,
  })

  if (rpcError) return errorResponse('TENANT_RUNTIME_CONFIG_SAVE_FAILED', 500, cors)

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: unknown; error?: unknown; details?: Record<string, unknown> }
    : null
  const code = typeof payload?.error === 'string' ? payload.error : null

  if (code) {
    return errorResponse(code, statusForRpcError(code), cors, payload?.details ?? {})
  }

  return jsonResponse({ data: payload?.data ?? null, error: null }, 200, cors)
})
