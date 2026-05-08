import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'

const TENANT_FIELDS = new Set([
  'display_name',
  'status',
  'plan',
  'release_channel',
  'schema_version',
  'notes',
])

const TENANT_STATUSES = new Set(['draft', 'provisioning', 'active', 'inactive', 'suspended', 'maintenance', 'archived'])
const RELEASE_CHANNELS = new Set(['stable', 'beta'])
const NON_NULL_TENANT_FIELDS = new Set(['display_name', 'status', 'release_channel'])
const TENANT_TRANSITIONS: Record<string, Set<string>> = {
  draft: new Set(['provisioning', 'inactive', 'archived']),
  provisioning: new Set(['active', 'maintenance', 'suspended', 'inactive', 'archived']),
  active: new Set(['maintenance', 'suspended', 'inactive', 'archived']),
  maintenance: new Set(['active', 'suspended', 'inactive', 'archived']),
  suspended: new Set(['active', 'maintenance', 'inactive', 'archived']),
  inactive: new Set(['provisioning', 'active', 'archived']),
  archived: new Set(),
}
const DOMAIN_SURFACES = new Set(['patient', 'ops'])
const DOMAIN_STATUSES = new Set(['pending', 'active', 'disabled'])
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  TENANT_NOT_FOUND: 404,
  DOMAIN_TAKEN: 409,
  INVALID_TENANT_STATUS_TRANSITION: 409,
  TENANT_ACTIVATION_BLOCKED: 409,
}

function sanitizeTenantPatch(value: unknown) {
  const patch = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const out: Record<string, unknown> = {}

  for (const [key, raw] of Object.entries(patch)) {
    if (!TENANT_FIELDS.has(key)) continue
    if (raw === null && NON_NULL_TENANT_FIELDS.has(key)) continue
    if (typeof raw !== 'string' && raw !== null) continue
    const text = typeof raw === 'string' ? raw.trim() : raw
    if (key === 'status' && text && !TENANT_STATUSES.has(text)) continue
    if (key === 'release_channel' && text && !RELEASE_CHANNELS.has(text)) continue
    if (key === 'display_name' && text === '') continue
    out[key] = text
  }

  return out
}

function canTransitionTenantStatus(from: string, to: unknown) {
  if (typeof to !== 'string' || !to || from === to) return true
  return TENANT_TRANSITIONS[from]?.has(to) === true
}

function normalizeHostname(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function isLocalHostname(hostname: string) {
  return hostname.startsWith('localhost:') || hostname.startsWith('127.0.0.1:')
}

function normalizeDomain(row: unknown, tenantId: string) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null
  const input = row as Record<string, unknown>
  const hostname = normalizeHostname(input.hostname)
  const surface = typeof input.surface === 'string' ? input.surface : ''
  const requestedStatus = typeof input.status === 'string' ? input.status : 'pending'
  const dnsStatus = typeof input.dns_status === 'string' ? input.dns_status : null
  const sslStatus = typeof input.ssl_status === 'string' ? input.ssl_status : null

  if (!hostname || !DOMAIN_SURFACES.has(surface) || !DOMAIN_STATUSES.has(requestedStatus)) return null

  const canActivate = isLocalHostname(hostname) || (dnsStatus === 'verified' && sslStatus === 'issued')

  return {
    id: typeof input.id === 'string' && input.id ? input.id : undefined,
    tenant_id: tenantId,
    hostname,
    surface,
    status: requestedStatus === 'active' && !canActivate ? 'pending' : requestedStatus,
    dns_status: dnsStatus,
    ssl_status: sslStatus,
  }
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

  const { data: context, response } = await requireSuperAdmin(req, ['operator', 'billing_admin'])
  if (response) return response

  const body = await readJsonBody(req)
  const tenantId = typeof body.tenantId === 'string' ? body.tenantId : ''
  if (!tenantId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data: existingTenant, error: tenantLookupError } = await context.client
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .maybeSingle()

  if (tenantLookupError) return errorResponse('TENANT_LOOKUP_FAILED', 500, cors)
  if (!existingTenant) return errorResponse('TENANT_NOT_FOUND', 404, cors)

  const patch = sanitizeTenantPatch(body.patch)
  const domains = Array.isArray(body.domains) ? body.domains : []
  const normalizedDomains = domains
    .map((row) => normalizeDomain(row, tenantId))
    .filter(Boolean)

  if (Object.keys(patch).length === 0 && normalizedDomains.length === 0) {
    return errorResponse('INVALID_REQUEST', 400, cors)
  }

  if (!canTransitionTenantStatus(existingTenant.status, patch.status)) {
    return errorResponse('INVALID_TENANT_STATUS_TRANSITION', 409, cors)
  }

  const { data: rpcPayload, error: rpcError } = await context.client.rpc('admin_update_tenant_atomic', {
    p_actor_id: context.admin.id,
    p_tenant_id: tenantId,
    p_patch: patch,
    p_domains: normalizedDomains,
  })

  if (rpcError) return errorResponse('TENANT_UPDATE_FAILED', 500, cors)

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: unknown; error?: unknown; details?: Record<string, unknown> }
    : null
  const code = typeof payload?.error === 'string' ? payload.error : null

  if (code) {
    return errorResponse(code, statusForRpcError(code), cors, payload?.details ?? {})
  }

  return jsonResponse({ data: payload?.data ?? null, error: null }, 200, cors)
})
