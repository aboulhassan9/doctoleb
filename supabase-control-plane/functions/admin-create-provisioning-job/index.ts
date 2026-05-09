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
  PROVIDER_CONNECTION_REQUIRED: 422,
  PROVIDER_CONNECTION_NOT_READY: 409,
  INVALID_PROVIDER_CONNECTION: 409,
  TENANT_SLUG_TAKEN: 409,
  DOMAIN_TAKEN: 409,
  PROVISIONING_JOB_NOT_FOUND: 404,
  FIRST_DOCTOR_ADMIN_CONFIG_FAILED: 500,
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

function normalizeNullableUuid(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return null
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : null
}

function normalizeAutomationMode(value: unknown) {
  const mode = normalizeText(value, 40).toLowerCase()
  return ['manual', 'assisted', 'automatic'].includes(mode) ? mode : 'manual'
}

function normalizeFirstDoctorAdmin(value: unknown) {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
  const email = normalizeText(input.email, 320).toLowerCase()
  const displayName = normalizeText(input.displayName ?? input.display_name, 160)
  const phone = normalizeText(input.phone, 40) || null

  if (!displayName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null
  return { email, displayName, phone }
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
  const automationMode = normalizeAutomationMode(body.automationMode ?? body.automation_mode)
  const supabaseConnectionId = normalizeNullableUuid(body.supabaseConnectionId ?? body.supabase_connection_id)
  const vercelConnectionId = normalizeNullableUuid(body.vercelConnectionId ?? body.vercel_connection_id)
  const firstDoctorAdmin = normalizeFirstDoctorAdmin(body.firstDoctorAdmin ?? body.first_doctor_admin)

  if (
    !requestedSlug
    || !requestedDisplayName
    || !firstDoctorAdmin
    || ((body.supabaseConnectionId ?? body.supabase_connection_id) && !supabaseConnectionId)
    || ((body.vercelConnectionId ?? body.vercel_connection_id) && !vercelConnectionId)
  ) {
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
    p_supabase_connection_id: supabaseConnectionId,
    p_vercel_connection_id: vercelConnectionId,
    p_automation_mode: automationMode,
  })

  if (rpcError) return errorResponse('TENANT_DRAFT_CREATE_FAILED', 500, cors)

  const payload = rpcPayload && typeof rpcPayload === 'object'
    ? rpcPayload as { data?: { created?: boolean; provisioningJob?: { id?: string } }; error?: unknown; details?: Record<string, unknown> }
    : null
  const code = typeof payload?.error === 'string' ? payload.error : null

  if (code) {
    return errorResponse(code, statusForRpcError(code), cors, payload?.details ?? {})
  }

  const provisioningJobId = typeof payload?.data?.provisioningJob?.id === 'string'
    ? payload.data.provisioningJob.id
    : ''

  if (!provisioningJobId) {
    return errorResponse('FIRST_DOCTOR_ADMIN_CONFIG_FAILED', 500, cors)
  }

  const { data: firstDoctorPayload, error: firstDoctorError } = await context.client.rpc('admin_set_provisioning_first_doctor_atomic', {
    p_actor_id: context.admin.id,
    p_job_id: provisioningJobId,
    p_email: firstDoctorAdmin.email,
    p_display_name: firstDoctorAdmin.displayName,
    p_phone: firstDoctorAdmin.phone,
  })

  const firstDoctorResult = firstDoctorPayload && typeof firstDoctorPayload === 'object'
    ? firstDoctorPayload as { data?: Record<string, unknown>; error?: unknown }
    : null
  const firstDoctorCode = typeof firstDoctorResult?.error === 'string' ? firstDoctorResult.error : null
  if (firstDoctorError || firstDoctorCode || !firstDoctorResult?.data) {
    return errorResponse(firstDoctorCode || 'FIRST_DOCTOR_ADMIN_CONFIG_FAILED', statusForRpcError(firstDoctorCode || 'FIRST_DOCTOR_ADMIN_CONFIG_FAILED'), cors)
  }

  if (payload?.data?.provisioningJob && firstDoctorResult.data) {
    payload.data.provisioningJob = {
      ...payload.data.provisioningJob,
      ...firstDoctorResult.data,
    }
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
