import {
  corsHeaders,
  errorResponse,
  jsonResponse,
  preflight,
  readJsonBody,
  requireSuperAdmin,
} from '../_shared/admin.ts'
import { CONTROL_PLANE_PROVISIONING_STEP_SELECT } from '../_shared/selects.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NO_MUTATION_STEP_CODES = new Set([
  'create_supabase_project',
  'apply_tenant_migrations',
  'configure_vercel_project',
  'store_runtime_config',
])
const RPC_ERROR_STATUS: Record<string, number> = {
  INVALID_REQUEST: 400,
  STEP_NOT_FOUND: 404,
  STEP_NOT_COMPENSATABLE: 409,
  COMPENSATION_NOT_AUTOMATED: 409,
  TENANT_UPDATE_FAILED: 500,
  STEP_COMPENSATION_RECORD_FAILED: 500,
}

type ProvisioningStep = {
  id: string
  tenant_id: string | null
  step_code: string
  status: string
  undo_strategy: string | null
}

function normalizeUuid(value: unknown) {
  if (typeof value !== 'string') return ''
  const id = value.trim().toLowerCase()
  return UUID.test(id) ? id : ''
}

function readPayloadError(payload: unknown) {
  return payload && typeof payload === 'object' && 'error' in payload
    ? String((payload as { error?: unknown }).error || '')
    : ''
}

function statusForError(code: string) {
  return RPC_ERROR_STATUS[code] ?? 500
}

async function loadStep(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  stepId: string,
) {
  const { data, error } = await context.client
    .from('tenant_provisioning_steps')
    .select(CONTROL_PLANE_PROVISIONING_STEP_SELECT)
    .eq('id', stepId)
    .maybeSingle()

  return { data: data as ProvisioningStep | null, error }
}

async function compensateActivation(
  context: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>['data']>,
  step: ProvisioningStep,
) {
  if (!step.tenant_id) {
    return { data: null, error: 'STEP_NOT_COMPENSATABLE' }
  }

  const { data: updated, error } = await context.client.rpc('admin_update_tenant_atomic', {
    p_actor_id: context.admin.id,
    p_tenant_id: step.tenant_id,
    p_patch: { status: 'inactive' },
    p_domains: [],
  })

  const code = error ? 'TENANT_UPDATE_FAILED' : readPayloadError(updated)
  if (code) return { data: null, error: code }

  return {
    data: {
      compensationType: 'tenant_status_inactivated',
      tenantStatus: 'inactive',
    },
    error: null,
  }
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
  const stepId = normalizeUuid(body.stepId ?? body.step_id)
  if (!stepId) return errorResponse('INVALID_REQUEST', 400, cors)

  const { data: step, error: stepError } = await loadStep(context, stepId)
  if (stepError) return errorResponse('STEP_LOOKUP_FAILED', 500, cors)
  if (!step) return errorResponse('STEP_NOT_FOUND', 404, cors)
  if (step.status !== 'succeeded') return errorResponse('STEP_NOT_COMPENSATABLE', 409, cors)
  if (!step.undo_strategy || step.undo_strategy === 'none') return errorResponse('STEP_NOT_COMPENSATABLE', 409, cors)

  let compensation: { data: Record<string, unknown> | null; error: string | null }
  if (step.step_code === 'activate_tenant') {
    compensation = await compensateActivation(context, step)
  } else if (NO_MUTATION_STEP_CODES.has(step.step_code)) {
    compensation = {
      data: {
        compensationType: 'no_op_verification_step',
        reason: 'This provisioning step only verified existing state and did not create or mutate an external resource.',
      },
      error: null,
    }
  } else {
    compensation = { data: null, error: 'COMPENSATION_NOT_AUTOMATED' }
  }

  if (compensation.error || !compensation.data) {
    return errorResponse(compensation.error || 'COMPENSATION_NOT_AUTOMATED', statusForError(compensation.error || ''), cors)
  }

  const { data: recorded, error: recordError } = await context.client.rpc('admin_mark_provisioning_step_rolled_back_atomic', {
    p_actor_id: context.admin.id,
    p_step_id: step.id,
    p_postconditions: compensation.data,
  })

  const code = recordError ? 'STEP_COMPENSATION_RECORD_FAILED' : readPayloadError(recorded)
  if (code) return errorResponse(code, statusForError(code), cors)

  const payload = recorded && typeof recorded === 'object' ? recorded as { data?: unknown } : null
  return jsonResponse({ data: payload?.data ?? null, error: null }, 200, cors)
})
