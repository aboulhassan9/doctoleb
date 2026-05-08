import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  INVALID_PLAN: 422,
  TENANT_SLUG_TAKEN: 409,
  DOMAIN_TAKEN: 409,
  TENANT_DRAFT_CREATE_FAILED: 500,
}

function normalizeSlug(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function normalizeText(value: unknown, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function normalizeDomains(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null
      const input = row as Record<string, unknown>
      const hostname = normalizeText(input.hostname, 300).toLowerCase()
      const surface = input.surface === 'ops' ? 'ops' : 'patient'
      if (!hostname) return null
      return {
        hostname,
        surface,
        status: 'pending',
        dns_status: hostname.startsWith('localhost:') ? null : 'pending',
        ssl_status: hostname.startsWith('localhost:') ? null : 'pending',
      }
    })
    .filter(Boolean)
}

function normalizeBranding(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeClientRequestId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : null
}

function statusForRpcError(code: string) {
  return RPC_ERROR_STATUS[code] ?? 500
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req)
  if (preflightResponse) return preflightResponse

  const cors = corsHeaders(req.headers.get('origin'))
  if (req.method !== 'POST') {
    return errorResponse('INVALID_METHOD', 405, cors)
  }

  const { data: context, response } = await requireSuperAdmin(req, ['operator'])
  if (response) return response

  const body = await readJsonBody(req)
  const clientRequestIdInput = body.clientRequestId ?? body.client_request_id
  const clientRequestId = normalizeClientRequestId(clientRequestIdInput)
  if (clientRequestIdInput && !clientRequestId) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const requestedSlug = normalizeSlug(body.requestedSlug)
  const requestedDisplayName = normalizeText(body.requestedDisplayName, 160)
  const requestedPlan = normalizeText(body.requestedPlan, 80) || 'starter'

  if (!requestedSlug || !requestedDisplayName) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  const requestedDomains = normalizeDomains(body.requestedDomains)

  const { data: rpcPayload, error: rpcError } = await context.client.rpc('admin_create_tenant_draft_atomic', {
    p_actor_id: context.admin.id,
    p_client_request_id: clientRequestId,
    p_requested_slug: requestedSlug,
    p_requested_display_name: requestedDisplayName,
    p_requested_plan: requestedPlan,
    p_requested_domains: requestedDomains,
    p_initial_branding: normalizeBranding(body.initialBranding),
  })

  if (rpcError) return errorResponse('TENANT_DRAFT_CREATE_FAILED', 500, cors)

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: { created?: boolean }; error?: unknown; details?: Record<string, unknown> }
    : null
  const code = typeof payload?.error === 'string' ? payload.error : null

  if (code) {
    return errorResponse(code, statusForRpcError(code), cors, payload?.details ?? {})
  }

  return jsonResponse(
    {
      data: payload?.data ?? null,
      error: null,
    },
    payload?.data?.created === false ? 200 : 201,
    cors,
  )
})
