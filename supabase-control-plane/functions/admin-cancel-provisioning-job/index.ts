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
  PROVISIONING_JOB_NOT_FOUND: 404,
  PROVISIONING_JOB_NOT_CANCELLABLE: 409,
  TENANT_ALREADY_ACTIVE: 409,
  PROVISIONING_CANCEL_BLOCKED: 409,
  PROVISIONING_CANCEL_FAILED: 500,
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return ''
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : ''
}

function normalizeReason(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : ''
}

function readPayloadError(payload: unknown) {
  return payload && typeof payload === 'object' && 'error' in payload
    ? String((payload as { error?: unknown }).error || '')
    : ''
}

function statusForError(code: string) {
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
  const jobId = normalizeUuid(body.jobId ?? body.provisioningJobId ?? body.provisioning_job_id)
  if (!jobId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data, error } = await context.client.rpc('admin_cancel_provisioning_job_atomic', {
    p_actor_id: context.admin.id,
    p_provisioning_job_id: jobId,
    p_reason: normalizeReason(body.reason),
  })

  if (error) return errorResponse('PROVISIONING_CANCEL_FAILED', 500, cors)

  const code = readPayloadError(data)
  if (code) return errorResponse(code, statusForError(code), cors)

  const payload = data && typeof data === 'object' ? data as { data?: unknown } : null
  return jsonResponse({ data: payload?.data ?? null, error: null }, 200, cors)
})
